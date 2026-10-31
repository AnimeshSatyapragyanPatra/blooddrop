// What a requester is told about a donor's proof of blood group.
//
// They see that it was checked, by what kind of evidence, and when — never the
// document. A requester is any member of the public who posted a request, so
// letting them open donors' scans would make identity documents browsable by
// strangers, which is the harvesting risk the masking elsewhere exists to stop.
import { supabase } from "./supabase.js";

export const DOC_TYPE_LABEL = {
  donor_card: "Blood donor card",
  lab_report: "Lab or pathology report",
  hospital_letter: "Hospital letter",
  govt_id: "Government ID",
};

/**
 * One query for a whole set of donors: userId -> the evidence their group was
 * verified against. Returns a Map, empty for anyone unverified.
 */
export async function verificationFor(userIds) {
  const unique = [...new Set((userIds || []).filter(Boolean))];
  if (!unique.length) return new Map();

  const { data } = await supabase
    .from("donor_documents")
    .select("user_id, doc_type, reviewed_at, status")
    .in("user_id", unique)
    .eq("status", "verified");

  const map = new Map();
  for (const doc of data || []) {
    // Keep the most recent check if a donor has verified more than once.
    const prev = map.get(doc.user_id);
    if (prev && new Date(prev.checkedAt) >= new Date(doc.reviewed_at)) continue;
    map.set(doc.user_id, {
      docType: doc.doc_type,
      evidence: DOC_TYPE_LABEL[doc.doc_type] || doc.doc_type,
      checkedAt: doc.reviewed_at,
    });
  }
  return map;
}

/** Shape shown to a requester next to a donor's blood group. */
export function verificationView(donorRow, evidence) {
  const verified = Boolean(donorRow?.blood_group_verified);
  if (!verified) {
    return { verified: false, evidence: null, checkedAt: null, label: "Self-declared" };
  }
  return {
    verified: true,
    evidence: evidence?.evidence || null,
    checkedAt: evidence?.checkedAt || donorRow?.blood_group_verified_at || null,
    label: evidence?.evidence ? `Checked against a ${evidence.evidence.toLowerCase()}` : "Checked by a moderator",
  };
}
