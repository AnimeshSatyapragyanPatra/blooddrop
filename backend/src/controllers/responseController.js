import { supabase } from "../lib/supabase.js";
import { eligibility } from "../lib/eligibility.js";
import { notifyInApp } from "../lib/notify.js";
import { maskName } from "../lib/privacy.js";
import { loadRequest, responseBoard } from "./requestController.js";

const DONOR_STATUSES = ["available", "unavailable"];
const OUTCOMES = ["donated", "no_show"];

/**
 * A donor answers an alert. This is the feature that replaces silence with a
 * status: the requester sees "3 answered, 1 on the way" instead of nothing.
 */
export async function respond(req, res) {
  const request = await loadRequest(req.params.id);
  if (!request) return res.status(404).json({ error: "Request not found" });
  if (request.status !== "open") return res.status(400).json({ error: "This request is no longer open" });
  if (request.requester_id === req.user.id) {
    return res.status(400).json({ error: "You cannot respond to your own request" });
  }

  const status = req.body?.status;
  if (!DONOR_STATUSES.includes(status)) {
    return res.status(400).json({ error: "Respond with either 'available' or 'unavailable'" });
  }

  const { data: donor } = await supabase.from("donors").select("*").eq("user_id", req.user.id).maybeSingle();
  if (!donor) return res.status(400).json({ error: "Register as a donor before responding" });

  if (status === "available") {
    const elig = eligibility(donor.last_donation_date);
    if (!elig.eligible) {
      return res.status(400).json({
        error: `You are not eligible to donate yet — ${elig.daysRemaining} day(s) left of the ${
          process.env.DONATION_GAP_DAYS || 90
        }-day gap.`,
      });
    }
  }

  const payload = {
    request_id: request.id,
    donor_user_id: req.user.id,
    status,
    note: String(req.body?.note || "").trim() || null,
    responded_at: new Date().toISOString(),
  };

  // Insert first and let the unique constraint on (request_id, donor_user_id)
  // settle it. Reading for an existing row and then branching cannot be made
  // safe: a donor double-tapping, or answering from two devices, can have both
  // requests read "no reply yet" before either one writes. A 23505 coming back
  // is the database's authoritative answer that this is a change of mind, not a
  // first reply — which is also what decides whether the counter moves.
  let saved;
  let isFirstReply = false;

  const { data: inserted, error: insertError } = await supabase
    .from("responses")
    .insert(payload)
    .select("*")
    .single();

  if (!insertError) {
    saved = inserted;
    isFirstReply = true;
  } else if (insertError.code === "23505") {
    const { data, error } = await supabase
      .from("responses")
      .update(payload)
      .eq("request_id", request.id)
      .eq("donor_user_id", req.user.id)
      .select("*")
      .single();
    if (error) return res.status(500).json({ error: error.message });
    saved = data;
  } else {
    return res.status(500).json({ error: insertError.message });
  }

  if (isFirstReply) {
    // Incremented in SQL rather than read-modify-write here: two donors
    // answering the same second would otherwise lose one of the increments,
    // and the reliability score is built on these counters.
    await supabase.rpc("record_donor_event", {
      p_user_id: req.user.id,
      p_field: "responses_given",
    });
  }

  await notifyInApp({
    userId: request.requester_id,
    type: "response",
    title: status === "available" ? "A donor is available" : "A donor cannot make it",
    body:
      status === "available"
        ? `${req.user.name} can donate ${donor.blood_group} for your ${request.blood_group} request at ${request.hospital_name}. Their contact is now unlocked.`
        : `${maskName(req.user.name)} is not available for your ${request.blood_group} request.`,
    requestId: request.id,
  });

  res.json({
    response: {
      id: saved.id,
      status: saved.status,
      note: saved.note,
      respondedAt: saved.responded_at,
      outcome: saved.outcome,
    },
    contactUnlocked: status === "available",
  });
}

/**
 * The requester closes the loop: the donation happened, or the donor never
 * showed. Both feed the reliability score; a confirmed donation also resets the
 * donor's 90-day eligibility clock automatically.
 */
export async function confirmOutcome(req, res) {
  const outcome = req.body?.outcome;
  if (!OUTCOMES.includes(outcome)) {
    return res.status(400).json({ error: "Outcome must be 'donated' or 'no_show'" });
  }

  const { data: response } = await supabase
    .from("responses")
    .select("*")
    .eq("id", req.params.responseId)
    .maybeSingle();
  if (!response) return res.status(404).json({ error: "Response not found" });

  const request = await loadRequest(response.request_id);
  if (!request) return res.status(404).json({ error: "Request not found" });
  if (request.requester_id !== req.user.id && req.user.role !== "admin") {
    return res.status(403).json({ error: "Only the requester can confirm an outcome" });
  }
  // Where the donation was booked at a facility, that facility records the
  // outcome — they are the only party who witnessed it. Letting a requester
  // self-report over the top would make the reliability score meaningless,
  // since they could credit a friend or punish a donor who did turn up.
  // Checked before the claim below, so a rejected confirmation leaves the
  // outcome unset rather than consuming it.
  const { data: appointment } = await supabase
    .from("appointments")
    .select("id, status")
    .eq("response_id", response.id)
    .maybeSingle();

  if (appointment && appointment.status !== "cancelled") {
    return res.status(409).json({
      error:
        "This donation is booked at a blood bank, so the blood bank records the outcome. " +
        "You will see it here once they confirm it.",
    });
  }

  // Claim the outcome with a conditional update rather than checking the row
  // and then writing it. `is("outcome", null)` folds the guard into the same
  // statement, so a double-click — or the requester and an admin confirming at
  // once — can only win once; the loser matches no rows and is told so. The
  // old check-then-write could let both through and double-count the donor.
  const { data: claimed, error: claimError } = await supabase
    .from("responses")
    .update({ outcome })
    .eq("id", response.id)
    .is("outcome", null)
    .select("*");

  if (claimError) return res.status(500).json({ error: claimError.message });
  if (!claimed?.length) {
    return res.status(400).json({ error: "This outcome has already been recorded" });
  }

  // Only the caller that won the claim moves the counters, and the arithmetic
  // happens in SQL so concurrent confirmations cannot lose an increment.
  await supabase.rpc("record_donor_event", {
    p_user_id: response.donor_user_id,
    p_field: outcome === "donated" ? "donations_confirmed" : "no_shows",
    p_reset_eligibility: outcome === "donated",
  });

  await notifyInApp({
    userId: response.donor_user_id,
    type: outcome === "donated" ? "thanks" : "status",
    title: outcome === "donated" ? "Donation confirmed — thank you" : "Marked as a no-show",
    body:
      outcome === "donated"
        ? `${request.hospital_name} confirmed your donation. Your eligibility clock has been reset to today.`
        : `${request.hospital_name} recorded that you did not attend. If this is wrong, report it from the request.`,
    requestId: request.id,
  });

  const board = await responseBoard(request);
  res.json({ ok: true, outcome, board });
}
