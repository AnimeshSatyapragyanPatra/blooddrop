import { supabase } from "../lib/supabase.js";

const TARGETS = ["request", "user"];
const REASONS = ["fake", "suspicious", "spam", "no_show", "harassment", "other"];

/** Anyone signed in can flag a request or a user; admins work the queue. */
export async function createReport(req, res) {
  const targetType = req.body?.targetType;
  const targetId = String(req.body?.targetId || "");
  const reason = req.body?.reason;

  if (!TARGETS.includes(targetType)) return res.status(400).json({ error: "Choose what you are reporting" });
  if (!targetId) return res.status(400).json({ error: "Missing the item being reported" });
  if (!REASONS.includes(reason)) return res.status(400).json({ error: "Choose a reason" });

  const table = targetType === "request" ? "requests" : "profiles";
  const column = targetType === "request" ? "id" : "user_id";
  const { data: target } = await supabase.from(table).select(column).eq(column, targetId).maybeSingle();
  if (!target) return res.status(404).json({ error: "The item you are reporting no longer exists" });

  const { data: mine } = await supabase
    .from("reports")
    .select("id, status")
    .eq("reporter_id", req.user.id)
    .eq("target_id", targetId)
    .eq("status", "open")
    .maybeSingle();
  if (mine) return res.status(400).json({ error: "You have already reported this — it is in the moderation queue." });

  const { data, error } = await supabase
    .from("reports")
    .insert({
      target_type: targetType,
      target_id: targetId,
      reporter_id: req.user.id,
      reason,
      details: String(req.body?.details || "").trim() || null,
      status: "open",
    })
    .select("*")
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ report: { id: data.id, status: data.status } });
}

export async function listMyReports(req, res) {
  const { data } = await supabase
    .from("reports")
    .select("*")
    .eq("reporter_id", req.user.id)
    .order("created_at", { ascending: false });

  res.json({
    reports: (data || []).map((r) => ({
      id: r.id,
      targetType: r.target_type,
      targetId: r.target_id,
      reason: r.reason,
      status: r.status,
      resolutionNote: r.resolution_note,
      createdAt: r.created_at,
    })),
  });
}

/** Request a hospital / blood-bank / NGO verification badge. */
export async function requestVerification(req, res) {
  const organization = String(req.body?.organization || "").trim();
  const orgType = ["hospital", "blood_bank", "ngo"].includes(req.body?.orgType) ? req.body.orgType : null;
  const proofRef = String(req.body?.proofRef || "").trim();

  if (!organization) return res.status(400).json({ error: "Enter the organisation name" });
  if (!orgType) return res.status(400).json({ error: "Choose the organisation type" });
  if (!proofRef) {
    return res.status(400).json({ error: "Add a registration/licence number an admin can check" });
  }

  const { data: pending } = await supabase
    .from("verifications")
    .select("id")
    .eq("user_id", req.user.id)
    .eq("status", "pending")
    .maybeSingle();
  if (pending) return res.status(400).json({ error: "Your verification request is already under review" });

  const { data, error } = await supabase
    .from("verifications")
    .insert({
      user_id: req.user.id,
      organization,
      org_type: orgType,
      proof_ref: proofRef,
      status: "pending",
      reviewed_by: null,
    })
    .select("*")
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ verification: { id: data.id, status: data.status, organization: data.organization } });
}
