import { supabase } from "../lib/supabase.js";
import { isBloodGroup, canDonate } from "../lib/blood.js";
import { isLatLng, haversineKm, roundKm } from "../lib/geo.js";
import { reliabilityView } from "../lib/reliability.js";
import { maskName, maskPhone } from "../lib/privacy.js";
import { findMatchingDonors, publicDonor, clampRadius } from "../lib/matching.js";
import { deliver, notifyInApp } from "../lib/notify.js";

const URGENCY = ["critical", "urgent", "routine"];
const OPEN_STATUSES = ["open"];

// How many donors a single dispatch reaches. Alerting everyone in range trains
// people to ignore alerts, so the shortlist is capped and reliability-ranked.
const DISPATCH_BATCH = Number(process.env.DISPATCH_BATCH || 25);

function requestView(request, { isOwner = false, viewerResponse = null } = {}) {
  return {
    id: request.id,
    bloodGroup: request.blood_group,
    unitsNeeded: request.units_needed,
    hospitalName: request.hospital_name,
    areaLabel: request.area_label,
    urgency: request.urgency,
    neededBy: request.needed_by,
    notes: request.notes,
    radiusKm: request.radius_km,
    status: request.status,
    verified: Boolean(request.verified),
    createdAt: request.created_at,
    lat: request.lat,
    lng: request.lng,
    // The patient's name is the requester's business, not the whole network's.
    patientName: isOwner ? request.patient_name : null,
    myResponse: viewerResponse
      ? { status: viewerResponse.status, note: viewerResponse.note, respondedAt: viewerResponse.responded_at, outcome: viewerResponse.outcome }
      : null,
  };
}

async function loadRequest(id) {
  const { data } = await supabase.from("requests").select("*").eq("id", id).maybeSingle();
  return data || null;
}

async function requesterOf(request) {
  const { data } = await supabase
    .from("profiles")
    .select("user_id, name, organization, org_type, verified, phone")
    .eq("user_id", request.requester_id)
    .maybeSingle();
  return data || null;
}

// ---- Create / list ---------------------------------------------------------

export async function createRequest(req, res) {
  const {
    patientName, bloodGroup, unitsNeeded, hospitalName, lat, lng,
    areaLabel, urgency, neededBy, notes, radiusKm, dispatch = true,
  } = req.body || {};

  if (!isBloodGroup(bloodGroup)) return res.status(400).json({ error: "Choose the blood group needed" });
  if (!String(hospitalName || "").trim()) return res.status(400).json({ error: "Hospital or blood bank name is required" });
  if (!isLatLng(Number(lat), Number(lng))) return res.status(400).json({ error: "Set the hospital location on the map" });
  if (!URGENCY.includes(urgency)) return res.status(400).json({ error: "Choose an urgency level" });

  const units = Number(unitsNeeded);
  if (!Number.isInteger(units) || units < 1 || units > 20) {
    return res.status(400).json({ error: "Units needed must be a whole number between 1 and 20" });
  }
  if (neededBy && Number.isNaN(Date.parse(neededBy))) {
    return res.status(400).json({ error: "\"Needed by\" is not a valid date and time" });
  }

  const { data, error } = await supabase
    .from("requests")
    .insert({
      requester_id: req.user.id,
      patient_name: String(patientName || "").trim() || null,
      blood_group: bloodGroup,
      units_needed: units,
      hospital_name: String(hospitalName).trim(),
      lat: Number(lat),
      lng: Number(lng),
      area_label: String(areaLabel || "").trim() || null,
      urgency,
      needed_by: neededBy || null,
      notes: String(notes || "").trim() || null,
      radius_km: clampRadius(radiusKm),
      status: "open",
      // A badge the requester cannot set themselves — it mirrors their
      // admin-reviewed profile verification at the moment of posting.
      verified: Boolean(req.user.verified),
    })
    .select("*")
    .single();

  if (error) return res.status(500).json({ error: error.message });

  let dispatched = null;
  if (dispatch) dispatched = await dispatchToMatches(data, req.user.id);

  res.status(201).json({ request: requestView(data, { isOwner: true }), dispatch: dispatched });
}

export async function listMyRequests(req, res) {
  const { data, error } = await supabase
    .from("requests")
    .select("*")
    .eq("requester_id", req.user.id)
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  const withCounts = [];
  for (const request of data) {
    const { data: responses } = await supabase.from("responses").select("status").eq("request_id", request.id);
    const { count } = await supabase.from("alerts").select("id", { count: "exact", head: true }).eq("request_id", request.id);
    withCounts.push({
      ...requestView(request, { isOwner: true }),
      stats: {
        alerted: count || 0,
        available: (responses || []).filter((r) => r.status === "available").length,
        unavailable: (responses || []).filter((r) => r.status === "unavailable").length,
        responded: (responses || []).length,
      },
    });
  }

  res.json({ requests: withCounts });
}

/** Open requests a donor can actually help with, nearest first. */
export async function listNearbyRequests(req, res) {
  const { data: donor } = await supabase.from("donors").select("*").eq("user_id", req.user.id).maybeSingle();
  if (!donor) return res.status(400).json({ error: "Register as a donor to see nearby requests" });

  const radius = clampRadius(req.query.radiusKm || 25);
  const { data: requests, error } = await supabase
    .from("requests")
    .select("*")
    .in("status", OPEN_STATUSES)
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  const { data: myResponses } = await supabase.from("responses").select("*").eq("donor_user_id", req.user.id);
  const responseByRequest = new Map((myResponses || []).map((r) => [r.request_id, r]));

  const rows = [];
  for (const request of requests) {
    if (request.requester_id === req.user.id) continue;
    if (!canDonate(donor.blood_group, request.blood_group)) continue;

    const distance = haversineKm(donor.lat, donor.lng, request.lat, request.lng);
    if (distance > radius) continue;

    const requester = await requesterOf(request);
    rows.push({
      ...requestView(request, { viewerResponse: responseByRequest.get(request.id) || null }),
      distanceKm: roundKm(distance),
      requester: {
        displayName: requester?.organization || maskName(requester?.name),
        organization: requester?.organization || null,
        orgType: requester?.org_type || null,
        verified: Boolean(requester?.verified),
      },
    });
  }

  rows.sort((a, b) => {
    const rank = { critical: 0, urgent: 1, routine: 2 };
    if (rank[a.urgency] !== rank[b.urgency]) return rank[a.urgency] - rank[b.urgency];
    return a.distanceKm - b.distanceKm;
  });

  res.json({ radiusKm: radius, myBloodGroup: donor.blood_group, requests: rows });
}

/** One request, with the live response board when the caller owns it. */
export async function getRequest(req, res) {
  const request = await loadRequest(req.params.id);
  if (!request) return res.status(404).json({ error: "Request not found" });

  const isOwner = request.requester_id === req.user.id;
  const isAdmin = req.user.role === "admin";

  const { data: myResponse } = await supabase
    .from("responses")
    .select("*")
    .eq("request_id", request.id)
    .eq("donor_user_id", req.user.id)
    .maybeSingle();

  const requester = await requesterOf(request);
  const payload = {
    request: {
      ...requestView(request, { isOwner: isOwner || isAdmin, viewerResponse: myResponse }),
      requester: {
        displayName: requester?.organization || maskName(requester?.name),
        organization: requester?.organization || null,
        orgType: requester?.org_type || null,
        verified: Boolean(requester?.verified),
      },
    },
  };

  if (isOwner || isAdmin) payload.board = await responseBoard(request);
  res.json(payload);
}

/** The requester's live view: who was alerted, who answered, what happened. */
async function responseBoard(request) {
  const { data: alerts } = await supabase
    .from("alerts")
    .select("*")
    .eq("request_id", request.id)
    .order("sent_at", { ascending: true });

  const { data: responses } = await supabase.from("responses").select("*").eq("request_id", request.id);
  const responseByDonor = new Map((responses || []).map((r) => [r.donor_user_id, r]));

  const rows = [];
  for (const alert of alerts || []) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("user_id, name, phone")
      .eq("user_id", alert.donor_user_id)
      .maybeSingle();
    const { data: donor } = await supabase
      .from("donors")
      .select("*")
      .eq("user_id", alert.donor_user_id)
      .maybeSingle();

    const response = responseByDonor.get(alert.donor_user_id) || null;
    const accepted = response?.status === "available";

    rows.push({
      responseId: response?.id || null,
      donorUserId: alert.donor_user_id,
      // Full name only once the donor has agreed to help.
      displayName: accepted ? profile?.name : maskName(profile?.name),
      bloodGroup: donor?.blood_group || null,
      distanceKm: alert.distance_km,
      areaLabel: donor?.area_label || null,
      channel: alert.channel,
      alertedAt: alert.sent_at,
      status: response?.status || "no_reply",
      note: response?.note || null,
      respondedAt: response?.responded_at || null,
      outcome: response?.outcome || null,
      reliability: donor ? reliabilityView(donor) : null,
      // Masked until accepted; the real number comes from /contact on request.
      phone: accepted ? null : maskPhone(profile?.phone),
      contactUnlocked: accepted,
    });
  }

  const answered = rows.filter((r) => r.status !== "no_reply").length;
  return {
    rows,
    summary: {
      alerted: rows.length,
      answered,
      available: rows.filter((r) => r.status === "available").length,
      unavailable: rows.filter((r) => r.status === "unavailable").length,
      donated: rows.filter((r) => r.outcome === "donated").length,
      awaiting: rows.length - answered,
    },
  };
}

// ---- Dispatch --------------------------------------------------------------

/** Alert matched donors who have not already been alerted for this request. */
async function dispatchToMatches(request, actorId) {
  const matches = await findMatchingDonors({
    bloodGroup: request.blood_group,
    lat: request.lat,
    lng: request.lng,
    radiusKm: request.radius_km,
    excludeUserId: request.requester_id,
  });

  const { data: existing } = await supabase.from("alerts").select("donor_user_id").eq("request_id", request.id);
  const alreadyAlerted = new Set((existing || []).map((a) => a.donor_user_id));

  const targets = matches.filter((m) => !alreadyAlerted.has(m.userId)).slice(0, DISPATCH_BATCH);

  const urgencyLabel = { critical: "Critical", urgent: "Urgent", routine: "Needed" }[request.urgency] || "Needed";
  const title = `${urgencyLabel}: ${request.blood_group} needed nearby`;

  const sent = [];
  for (const match of targets) {
    const body =
      `${request.hospital_name} needs ${request.units_needed} unit(s) of ${request.blood_group}` +
      ` — about ${match.distanceKm} km from you. Open BloodDrop to respond.`;

    const { channel, status } = await deliver({
      userId: match.userId,
      email: match._contact.email,
      phone: match._contact.phone,
      preference: match.contactPref,
      title,
      body,
      requestId: request.id,
    });

    await supabase.from("alerts").insert({
      request_id: request.id,
      donor_user_id: match.userId,
      channel,
      status,
      distance_km: match.distanceKm,
    });

    // Counter that feeds the reliability score's denominator.
    const { data: donorRow } = await supabase
      .from("donors")
      .select("alerts_received")
      .eq("user_id", match.userId)
      .maybeSingle();
    await supabase
      .from("donors")
      .update({ alerts_received: (donorRow?.alerts_received || 0) + 1 })
      .eq("user_id", match.userId);

    sent.push({ userId: match.userId, channel, distanceKm: match.distanceKm });
  }

  console.log(`[blooddrop] request ${request.id} dispatched to ${sent.length} donor(s) by ${actorId}`);
  return { alerted: sent.length, matched: matches.length, skippedAlreadyAlerted: alreadyAlerted.size };
}

/** Manual re-dispatch — "alert more donors" after a quiet first round. */
export async function dispatchRequest(req, res) {
  const request = await loadRequest(req.params.id);
  if (!request) return res.status(404).json({ error: "Request not found" });
  if (request.requester_id !== req.user.id && req.user.role !== "admin") {
    return res.status(403).json({ error: "Only the requester can send alerts for this request" });
  }
  if (request.status !== "open") return res.status(400).json({ error: "This request is no longer open" });

  const widened = req.body?.radiusKm ? clampRadius(req.body.radiusKm) : request.radius_km;
  if (widened !== request.radius_km) {
    await supabase.from("requests").update({ radius_km: widened }).eq("id", request.id);
    request.radius_km = widened;
  }

  try {
    const result = await dispatchToMatches(request, req.user.id);
    res.json({ dispatch: result, radiusKm: request.radius_km });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/** Who *would* be alerted, without alerting anyone — shown before posting. */
export async function previewMatches(req, res) {
  const { bloodGroup, lat, lng, radiusKm } = req.query;
  if (!isBloodGroup(bloodGroup)) return res.status(400).json({ error: "Choose the blood group needed" });
  if (!isLatLng(Number(lat), Number(lng))) return res.status(400).json({ error: "Set the hospital location on the map" });

  try {
    const matches = await findMatchingDonors({
      bloodGroup,
      lat: Number(lat),
      lng: Number(lng),
      radiusKm: clampRadius(radiusKm),
      excludeUserId: req.user.id,
    });
    res.json({
      count: matches.length,
      willAlert: Math.min(matches.length, DISPATCH_BATCH),
      donors: matches.slice(0, DISPATCH_BATCH).map(publicDonor),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ---- Status ----------------------------------------------------------------

export async function closeRequest(req, res) {
  const request = await loadRequest(req.params.id);
  if (!request) return res.status(404).json({ error: "Request not found" });
  if (request.requester_id !== req.user.id && req.user.role !== "admin") {
    return res.status(403).json({ error: "Only the requester can close this request" });
  }

  const status = req.body?.status === "fulfilled" ? "fulfilled" : "closed";
  const { data, error } = await supabase
    .from("requests")
    .update({ status })
    .eq("id", request.id)
    .select("*")
    .single();
  if (error) return res.status(500).json({ error: error.message });

  // Tell everyone who said yes that they can stand down.
  const { data: responders } = await supabase
    .from("responses")
    .select("donor_user_id")
    .eq("request_id", request.id)
    .eq("status", "available");

  for (const r of responders || []) {
    await notifyInApp({
      userId: r.donor_user_id,
      type: "status",
      title: status === "fulfilled" ? "Request fulfilled — thank you" : "Request closed",
      body: `The ${request.blood_group} request at ${request.hospital_name} is no longer active.`,
      requestId: request.id,
    });
  }

  res.json({ request: requestView(data, { isOwner: true }) });
}

export { requestView, loadRequest, responseBoard };
