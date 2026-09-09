// The masking layer. Phone numbers live on the server and are only released to
// the *other side of an accepted match* — a donor who said "available" on a
// request, and the requester of that request. Every reveal is announced to the
// person whose number was shown, and there is a relay so the two sides can talk
// without a number changing hands at all.
import { supabase } from "../lib/supabase.js";
import { notifyInApp } from "../lib/notify.js";
import { maskName } from "../lib/privacy.js";
import { loadRequest } from "./requestController.js";

/** Is `donorUserId` connected to `request` by an accepted response? */
async function acceptedResponse(requestId, donorUserId) {
  const { data } = await supabase
    .from("responses")
    .select("*")
    .eq("request_id", requestId)
    .eq("donor_user_id", donorUserId)
    .maybeSingle();
  return data?.status === "available" ? data : null;
}

async function profileOf(userId) {
  const { data } = await supabase
    .from("profiles")
    .select("user_id, name, email, phone, organization, verified")
    .eq("user_id", userId)
    .maybeSingle();
  return data || null;
}

/**
 * GET /api/requests/:id/contact
 * A donor who accepted gets the requester's real number (and vice versa via
 * ?donorUserId= when the caller is the requester).
 */
export async function revealContact(req, res) {
  const request = await loadRequest(req.params.id);
  if (!request) return res.status(404).json({ error: "Request not found" });

  const isRequester = request.requester_id === req.user.id;
  const donorUserId = isRequester ? String(req.query.donorUserId || "") : req.user.id;

  if (isRequester && !donorUserId) {
    return res.status(400).json({ error: "Which donor's contact do you need?" });
  }

  const accepted = await acceptedResponse(request.id, donorUserId);
  if (!accepted) {
    return res.status(403).json({
      error: "Contact details unlock only after the donor accepts this request.",
    });
  }

  const targetId = isRequester ? donorUserId : request.requester_id;
  const target = await profileOf(targetId);
  if (!target) return res.status(404).json({ error: "Contact not found" });

  // The person whose number was shown is told who looked, and why.
  await notifyInApp({
    userId: targetId,
    type: "contact",
    title: "Your contact was shared",
    body: `${
      req.user.organization || maskName(req.user.name)
    } viewed your phone number for the ${request.blood_group} request at ${request.hospital_name}.`,
    requestId: request.id,
  });

  console.log(`[blooddrop] contact reveal: ${req.user.id} -> ${targetId} (request ${request.id})`);

  res.json({
    contact: {
      name: target.organization || target.name,
      phone: target.phone,
      email: target.email,
      verified: Boolean(target.verified),
      role: isRequester ? "donor" : "requester",
    },
  });
}

/**
 * POST /api/requests/:id/relay
 * Send a message to the other party without either side seeing a number.
 * This is the default path — revealing the phone number is the escalation.
 */
export async function relayMessage(req, res) {
  const request = await loadRequest(req.params.id);
  if (!request) return res.status(404).json({ error: "Request not found" });

  const message = String(req.body?.message || "").trim();
  if (!message) return res.status(400).json({ error: "Write a message to send" });
  if (message.length > 500) return res.status(400).json({ error: "Keep relay messages under 500 characters" });

  const isRequester = request.requester_id === req.user.id;
  const donorUserId = isRequester ? String(req.body?.donorUserId || "") : req.user.id;

  const accepted = await acceptedResponse(request.id, donorUserId);
  if (!accepted) {
    return res.status(403).json({ error: "You can only message a donor who has accepted this request." });
  }

  const targetId = isRequester ? donorUserId : request.requester_id;
  const fromLabel = isRequester
    ? req.user.organization || `${maskName(req.user.name)} (requester)`
    : `${maskName(req.user.name)} (donor)`;

  await notifyInApp({
    userId: targetId,
    type: "message",
    title: `Message from ${fromLabel}`,
    body: message,
    requestId: request.id,
  });

  res.status(201).json({ ok: true, deliveredTo: "inapp" });
}
