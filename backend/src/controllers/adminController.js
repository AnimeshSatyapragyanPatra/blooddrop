import { supabase } from "../lib/supabase.js";
import { notifyInApp } from "../lib/notify.js";
import { reliabilityView } from "../lib/reliability.js";
import { eligibility } from "../lib/eligibility.js";

// ---- Moderation queue ------------------------------------------------------

async function describeTarget(report) {
  if (report.target_type === "request") {
    const { data } = await supabase.from("requests").select("*").eq("id", report.target_id).maybeSingle();
    if (!data) return { label: "(deleted request)", status: null };
    return {
      label: `${data.blood_group} · ${data.hospital_name}`,
      status: data.status,
      urgency: data.urgency,
      verified: Boolean(data.verified),
      notes: data.notes,
      requesterId: data.requester_id,
      createdAt: data.created_at,
    };
  }
  const { data } = await supabase
    .from("profiles")
    .select("user_id, name, email, role, organization, verified")
    .eq("user_id", report.target_id)
    .maybeSingle();
  if (!data) return { label: "(deleted user)", status: null };
  return { label: `${data.name} · ${data.email}`, role: data.role, verified: Boolean(data.verified) };
}

export async function listReports(req, res) {
  const status = ["open", "resolved", "dismissed"].includes(req.query.status) ? req.query.status : "open";
  const { data, error } = await supabase
    .from("reports")
    .select("*")
    .eq("status", status)
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  const rows = [];
  for (const report of data || []) {
    const { data: reporter } = await supabase
      .from("profiles")
      .select("name, email")
      .eq("user_id", report.reporter_id)
      .maybeSingle();
    rows.push({
      id: report.id,
      targetType: report.target_type,
      targetId: report.target_id,
      target: await describeTarget(report),
      reason: report.reason,
      details: report.details,
      status: report.status,
      resolutionNote: report.resolution_note,
      reportedBy: reporter?.name || "Unknown",
      createdAt: report.created_at,
    });
  }

  res.json({ status, reports: rows });
}

/**
 * Resolve a report. "remove" takes the request down and tells everyone who was
 * mobilised for it, so a fake request stops costing donors trips.
 */
export async function resolveReport(req, res) {
  const action = req.body?.action;
  if (!["dismiss", "remove", "warn"].includes(action)) {
    return res.status(400).json({ error: "Action must be 'dismiss', 'remove' or 'warn'" });
  }

  const { data: report } = await supabase.from("reports").select("*").eq("id", req.params.id).maybeSingle();
  if (!report) return res.status(404).json({ error: "Report not found" });
  if (report.status !== "open") return res.status(400).json({ error: "This report is already resolved" });

  const note = String(req.body?.note || "").trim() || null;

  if (action === "remove" && report.target_type === "request") {
    const { data: request } = await supabase.from("requests").select("*").eq("id", report.target_id).maybeSingle();
    if (request) {
      await supabase.from("requests").update({ status: "removed" }).eq("id", request.id);

      const { data: responders } = await supabase
        .from("responses")
        .select("donor_user_id")
        .eq("request_id", request.id);
      const audience = new Set([request.requester_id, ...(responders || []).map((r) => r.donor_user_id)]);
      for (const userId of audience) {
        await notifyInApp({
          userId,
          type: "moderation",
          title: "A request was removed by moderators",
          body: `The ${request.blood_group} request at ${request.hospital_name} was taken down after a report.${
            note ? ` Reason: ${note}` : ""
          }`,
          requestId: request.id,
        });
      }
    }
  }

  if (action === "warn") {
    const targetUserId =
      report.target_type === "user"
        ? report.target_id
        : (await supabase.from("requests").select("requester_id").eq("id", report.target_id).maybeSingle()).data
            ?.requester_id;
    if (targetUserId) {
      await notifyInApp({
        userId: targetUserId,
        type: "moderation",
        title: "Warning from moderators",
        body: note || "A report about your activity was upheld. Please review the community rules.",
      });
    }
  }

  const { data, error } = await supabase
    .from("reports")
    .update({
      status: action === "dismiss" ? "dismissed" : "resolved",
      resolution_note: note,
      resolved_by: req.user.id,
    })
    .eq("id", report.id)
    .select("*")
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ report: { id: data.id, status: data.status, resolutionNote: data.resolution_note } });
}

// ---- Verification queue ----------------------------------------------------

export async function listVerifications(req, res) {
  const status = ["pending", "verified", "rejected"].includes(req.query.status) ? req.query.status : "pending";
  const { data, error } = await supabase
    .from("verifications")
    .select("*")
    .eq("status", status)
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  const rows = [];
  for (const v of data || []) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("name, email, phone, role")
      .eq("user_id", v.user_id)
      .maybeSingle();
    rows.push({
      id: v.id,
      userId: v.user_id,
      organization: v.organization,
      orgType: v.org_type,
      proofRef: v.proof_ref,
      status: v.status,
      createdAt: v.created_at,
      applicant: profile ? { name: profile.name, email: profile.email, phone: profile.phone, role: profile.role } : null,
    });
  }

  res.json({ status, verifications: rows });
}

export async function reviewVerification(req, res) {
  const approve = req.body?.approve === true;
  const { data: verification } = await supabase
    .from("verifications")
    .select("*")
    .eq("id", req.params.id)
    .maybeSingle();

  if (!verification) return res.status(404).json({ error: "Verification request not found" });
  if (verification.status !== "pending") return res.status(400).json({ error: "This request was already reviewed" });

  await supabase
    .from("verifications")
    .update({ status: approve ? "verified" : "rejected", reviewed_by: req.user.id })
    .eq("id", verification.id);

  if (approve) {
    await supabase
      .from("profiles")
      .update({ verified: true, organization: verification.organization, org_type: verification.org_type })
      .eq("user_id", verification.user_id);
  }

  await notifyInApp({
    userId: verification.user_id,
    type: "verification",
    title: approve ? "Your organisation is verified" : "Verification not approved",
    body: approve
      ? `${verification.organization} is now verified. New requests you post will carry the verified badge.`
      : `We could not verify ${verification.organization} from the details provided. You can submit again with a checkable registration number.`,
  });

  res.json({ ok: true, status: approve ? "verified" : "rejected" });
}

// ---- Overview --------------------------------------------------------------

export async function overview(_req, res) {
  const [{ data: profiles }, { data: donors }, { data: requests }, { data: responses }, { data: reports }] =
    await Promise.all([
      supabase.from("profiles").select("*"),
      supabase.from("donors").select("*"),
      supabase.from("requests").select("*"),
      supabase.from("responses").select("*"),
      supabase.from("reports").select("*"),
    ]);

  const eligible = (donors || []).filter((d) => !d.paused && eligibility(d.last_donation_date).eligible);

  const byGroup = {};
  for (const d of donors || []) {
    byGroup[d.blood_group] = byGroup[d.blood_group] || { total: 0, eligible: 0 };
    byGroup[d.blood_group].total += 1;
    if (eligible.includes(d)) byGroup[d.blood_group].eligible += 1;
  }

  const openRequests = (requests || []).filter((r) => r.status === "open");
  const answered = new Set((responses || []).map((r) => r.request_id));

  res.json({
    totals: {
      donors: (donors || []).length,
      eligibleDonors: eligible.length,
      users: (profiles || []).length,
      verifiedRequesters: (profiles || []).filter((p) => p.verified).length,
      openRequests: openRequests.length,
      fulfilledRequests: (requests || []).filter((r) => r.status === "fulfilled").length,
      openReports: (reports || []).filter((r) => r.status === "open").length,
      responseRate: openRequests.length
        ? Math.round((openRequests.filter((r) => answered.has(r.id)).length / openRequests.length) * 100)
        : null,
    },
    byGroup,
    topDonors: (donors || [])
      .map((d) => ({ userId: d.user_id, bloodGroup: d.blood_group, ...reliabilityView(d) }))
      .sort((a, b) => b.donationsConfirmed - a.donationsConfirmed || b.score - a.score)
      .slice(0, 5),
  });
}
