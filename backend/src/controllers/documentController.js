// Blood-group verification by document.
//
// The group a donor types is the most load-bearing field in the app, and until
// now nothing checked it. A donor can submit proof; a reviewer confirms it and
// the donor's record is marked verified.
//
// On retention: the file is deleted the moment a decision is recorded. Keeping
// scans of identity documents past their purpose is a liability that grows with
// every upload, and the decision is the only part anyone needs afterwards.
import { supabase } from "../lib/supabase.js";
import { isBloodGroup } from "../lib/blood.js";
import { notifyInApp } from "../lib/notify.js";
import {
  decodeUpload, putDocument, getDocument, deleteDocument, MAX_BYTES, ALLOWED_MIME,
} from "../lib/storage.js";

const DOC_TYPES = {
  donor_card: "Blood donor card",
  lab_report: "Lab or pathology report",
  hospital_letter: "Hospital letter or discharge summary",
  govt_id: "Government ID showing blood group",
};

function documentView(doc, { includePath = false } = {}) {
  return {
    id: doc.id,
    docType: doc.doc_type,
    docTypeLabel: DOC_TYPES[doc.doc_type] || doc.doc_type,
    claimedBloodGroup: doc.claimed_blood_group,
    status: doc.status,
    reviewNote: doc.review_note,
    reviewedAt: doc.reviewed_at,
    createdAt: doc.created_at,
    mimeType: doc.mime_type,
    byteSize: doc.byte_size,
    // Whether the scan itself is still around, or has been purged post-review.
    fileAvailable: Boolean(doc.file_path),
    ...(includePath ? { filePath: doc.file_path } : {}),
  };
}

export function documentConfig(_req, res) {
  res.json({
    docTypes: Object.entries(DOC_TYPES).map(([value, label]) => ({ value, label })),
    maxBytes: MAX_BYTES,
    allowedMime: ALLOWED_MIME,
  });
}

// ---- Donor side -------------------------------------------------------------

export async function submitDocument(req, res) {
  const { docType, claimedBloodGroup, file, mimeType } = req.body || {};

  if (!DOC_TYPES[docType]) return res.status(400).json({ error: "Choose what kind of document this is" });
  if (!isBloodGroup(claimedBloodGroup)) return res.status(400).json({ error: "Choose the blood group it shows" });

  const { data: donor } = await supabase.from("donors").select("*").eq("user_id", req.user.id).maybeSingle();
  if (!donor) return res.status(400).json({ error: "Register as a donor before submitting proof" });

  const { data: pending } = await supabase
    .from("donor_documents")
    .select("id")
    .eq("user_id", req.user.id)
    .eq("status", "pending")
    .maybeSingle();
  if (pending) {
    return res.status(400).json({ error: "You already have a document awaiting review." });
  }

  const decoded = decodeUpload(file, mimeType);
  if (decoded.error) return res.status(400).json({ error: decoded.error });

  const stored = await putDocument(req.user.id, decoded.buffer, decoded.mime);
  if (stored.error) return res.status(500).json({ error: stored.error });

  const { data, error } = await supabase
    .from("donor_documents")
    .insert({
      user_id: req.user.id,
      doc_type: docType,
      claimed_blood_group: claimedBloodGroup,
      file_path: stored.path,
      mime_type: decoded.mime,
      byte_size: decoded.buffer.length,
      status: "pending",
    })
    .select("*")
    .single();

  if (error) {
    await deleteDocument(stored.path);
    return res.status(500).json({ error: error.message });
  }

  res.status(201).json({ document: documentView(data) });
}

export async function listMyDocuments(req, res) {
  const { data } = await supabase
    .from("donor_documents")
    .select("*")
    .eq("user_id", req.user.id)
    .order("created_at", { ascending: false });

  const { data: donor } = await supabase
    .from("donors")
    .select("blood_group, blood_group_verified, blood_group_verified_at")
    .eq("user_id", req.user.id)
    .maybeSingle();

  const verifiedDoc = (data || []).find((d) => d.status === "verified");

  res.json({
    documents: (data || []).map((d) => documentView(d)),
    evidence: verifiedDoc ? DOC_TYPES[verifiedDoc.doc_type] : null,
    bloodGroup: donor?.blood_group || null,
    verified: Boolean(donor?.blood_group_verified),
    verifiedAt: donor?.blood_group_verified_at || null,
  });
}

// ---- Reviewer side ----------------------------------------------------------

export async function listDocumentsForReview(req, res) {
  const status = ["pending", "verified", "rejected"].includes(req.query.status) ? req.query.status : "pending";

  const { data, error } = await supabase
    .from("donor_documents")
    .select("*")
    .eq("status", status)
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  const rows = [];
  for (const doc of data || []) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("name, email")
      .eq("user_id", doc.user_id)
      .maybeSingle();
    const { data: donor } = await supabase
      .from("donors")
      .select("blood_group, blood_group_verified")
      .eq("user_id", doc.user_id)
      .maybeSingle();

    rows.push({
      ...documentView(doc),
      userId: doc.user_id,
      applicant: profile ? { name: profile.name, email: profile.email } : null,
      // Flagged for the reviewer: the proof contradicts what is on the profile.
      profileBloodGroup: donor?.blood_group || null,
      mismatch: Boolean(donor && donor.blood_group !== doc.claimed_blood_group),
      alreadyVerified: Boolean(donor?.blood_group_verified),
    });
  }

  res.json({ status, documents: rows });
}

/** Streams the scan to a reviewer. Never exposed to anyone else. */
export async function viewDocumentFile(req, res) {
  const { data: doc } = await supabase
    .from("donor_documents")
    .select("*")
    .eq("id", req.params.id)
    .maybeSingle();

  if (!doc) return res.status(404).json({ error: "Document not found" });
  if (!doc.file_path) {
    return res.status(410).json({ error: "This document was purged after review." });
  }

  const file = await getDocument(doc.file_path);
  if (file.error) return res.status(404).json({ error: file.error });

  res.setHeader("Content-Type", doc.mime_type || "application/octet-stream");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Disposition", "inline");
  res.send(file.buffer);
}

export async function reviewDocument(req, res) {
  const approve = req.body?.approve === true;
  const note = String(req.body?.note || "").trim() || null;

  const { data: doc } = await supabase
    .from("donor_documents")
    .select("*")
    .eq("id", req.params.id)
    .maybeSingle();

  if (!doc) return res.status(404).json({ error: "Document not found" });
  if (doc.status !== "pending") return res.status(400).json({ error: "This document was already reviewed" });
  if (!approve && !note) {
    return res.status(400).json({ error: "Give a reason when rejecting, so the donor can fix it." });
  }

  await supabase
    .from("donor_documents")
    .update({
      status: approve ? "verified" : "rejected",
      reviewed_by: req.user.id,
      reviewed_at: new Date().toISOString(),
      review_note: note,
      // The decision is kept; the scan is not.
      file_path: null,
    })
    .eq("id", doc.id);

  await deleteDocument(doc.file_path);

  if (approve) {
    // The document is the authority: the profile is corrected to match it.
    await supabase
      .from("donors")
      .update({
        blood_group: doc.claimed_blood_group,
        blood_group_verified: true,
        blood_group_verified_at: new Date().toISOString(),
      })
      .eq("user_id", doc.user_id);
  }

  await notifyInApp({
    userId: doc.user_id,
    type: "verification",
    title: approve ? "Blood group verified" : "Proof not accepted",
    body: approve
      ? `Your ${doc.claimed_blood_group} blood group is now verified. Requesters will see that it was checked against a document.`
      : `We could not verify your blood group from that document.${note ? ` Reason: ${note}` : ""} You can submit another.`,
  });

  res.json({ ok: true, status: approve ? "verified" : "rejected" });
}
