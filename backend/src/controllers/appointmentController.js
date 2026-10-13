// Booking a donation slot, and closing it out.
//
// A donor who accepts an alert is not sent to the patient — they are sent to a
// licensed facility at a specific time. The facility, not the requester, says
// whether the donation happened: they are the only party who witnessed it, and
// letting a requester self-report would make the reliability score worth
// nothing.
import { supabase } from "../lib/supabase.js";
import { isBookable } from "../lib/slots.js";
import { eligibility } from "../lib/eligibility.js";
import { notifyInApp } from "../lib/notify.js";
import { maskName } from "../lib/privacy.js";
import { facilityView } from "./facilityController.js";
import { loadRequest } from "./requestController.js";

async function facilityById(id) {
  const { data } = await supabase.from("facilities").select("*").eq("id", id).maybeSingle();
  return data || null;
}

function appointmentView(appointment, { facility, request, donor } = {}) {
  return {
    id: appointment.id,
    requestId: appointment.request_id,
    scheduledAt: appointment.scheduled_at,
    status: appointment.status,
    note: appointment.note,
    confirmedAt: appointment.confirmed_at,
    facility: facility ? facilityView(facility) : null,
    bloodGroup: request?.blood_group || donor?.blood_group || null,
    unitsNeeded: request?.units_needed ?? null,
  };
}

// ---- Donor books ------------------------------------------------------------

/** POST /api/requests/:id/book — one booking per accepted response. */
export async function bookSlot(req, res) {
  const request = await loadRequest(req.params.id);
  if (!request) return res.status(404).json({ error: "Request not found" });
  if (request.status !== "open") return res.status(400).json({ error: "This request is no longer open" });

  const { data: response } = await supabase
    .from("responses")
    .select("*")
    .eq("request_id", request.id)
    .eq("donor_user_id", req.user.id)
    .maybeSingle();

  if (!response || response.status !== "available") {
    return res.status(403).json({ error: "Accept the request first, then book a slot." });
  }

  const { data: donor } = await supabase.from("donors").select("*").eq("user_id", req.user.id).maybeSingle();
  if (!donor) return res.status(400).json({ error: "Register as a donor first" });

  const elig = eligibility(donor.last_donation_date);
  if (!elig.eligible) {
    return res.status(400).json({
      error: `You are not eligible to donate yet — ${elig.daysRemaining} day(s) of the gap remain.`,
    });
  }

  const facilityId = req.body?.facilityId || request.facility_id;
  if (!facilityId) return res.status(400).json({ error: "Choose a facility to donate at" });

  const facility = await facilityById(facilityId);
  if (!facility) return res.status(404).json({ error: "Facility not found" });
  if (!facility.verified) {
    return res.status(400).json({ error: "That facility is not verified, so it cannot take bookings." });
  }

  const { data: taken } = await supabase
    .from("appointments")
    .select("scheduled_at, status")
    .eq("facility_id", facility.id);

  const check = isBookable(facility, req.body?.scheduledAt, taken || []);
  if (!check.ok) return res.status(400).json({ error: check.reason });

  const { data: existing } = await supabase
    .from("appointments")
    .select("*")
    .eq("response_id", response.id)
    .maybeSingle();

  const payload = {
    request_id: request.id,
    response_id: response.id,
    donor_user_id: req.user.id,
    facility_id: facility.id,
    scheduled_at: new Date(req.body.scheduledAt).toISOString(),
    status: "booked",
  };

  let saved;
  if (existing) {
    const { data, error } = await supabase
      .from("appointments")
      .update(payload)
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) return res.status(500).json({ error: error.message });
    saved = data;
  } else {
    const { data, error } = await supabase.from("appointments").insert(payload).select("*").single();
    if (error) return res.status(500).json({ error: error.message });
    saved = data;
  }

  const when = new Date(saved.scheduled_at).toLocaleString();
  await notifyInApp({
    userId: request.requester_id,
    type: "response",
    title: "A donor booked a donation slot",
    body: `${maskName(req.user.name)} is booked at ${facility.name} on ${when} for your ${request.blood_group} request.`,
    requestId: request.id,
  });

  res.status(201).json({ appointment: appointmentView(saved, { facility, request }) });
}

/** Donor cancels their own booking. */
export async function cancelAppointment(req, res) {
  const { data: appointment } = await supabase
    .from("appointments")
    .select("*")
    .eq("id", req.params.id)
    .maybeSingle();

  if (!appointment) return res.status(404).json({ error: "Booking not found" });
  if (appointment.donor_user_id !== req.user.id) {
    return res.status(403).json({ error: "That is not your booking" });
  }
  if (appointment.status !== "booked") {
    return res.status(400).json({ error: "This booking has already been closed out" });
  }

  await supabase.from("appointments").update({ status: "cancelled" }).eq("id", appointment.id);

  const request = await loadRequest(appointment.request_id);
  if (request) {
    await notifyInApp({
      userId: request.requester_id,
      type: "status",
      title: "A donor cancelled their slot",
      body: `A booked donation for your ${request.blood_group} request was cancelled. The donor can rebook.`,
      requestId: request.id,
    });
  }

  res.json({ ok: true, status: "cancelled" });
}

/** GET /api/me/appointments */
export async function listMyAppointments(req, res) {
  const { data } = await supabase
    .from("appointments")
    .select("*")
    .eq("donor_user_id", req.user.id)
    .order("scheduled_at", { ascending: true });

  const rows = [];
  for (const appointment of data || []) {
    rows.push(
      appointmentView(appointment, {
        facility: await facilityById(appointment.facility_id),
        request: await loadRequest(appointment.request_id),
      })
    );
  }
  res.json({ appointments: rows });
}

// ---- Facility closes out ----------------------------------------------------

/** GET /api/facility/appointments — the staff's own queue. */
export async function listFacilityAppointments(req, res) {
  if (!req.user.facilityId) {
    return res.status(403).json({ error: "Your account is not linked to a facility" });
  }

  const status = ["booked", "completed", "no_show", "cancelled"].includes(req.query.status)
    ? req.query.status
    : "booked";

  const { data } = await supabase
    .from("appointments")
    .select("*")
    .eq("facility_id", req.user.facilityId)
    .eq("status", status)
    .order("scheduled_at", { ascending: true });

  const rows = [];
  for (const appointment of data || []) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("name, phone")
      .eq("user_id", appointment.donor_user_id)
      .maybeSingle();
    const { data: donor } = await supabase
      .from("donors")
      .select("blood_group, last_donation_date")
      .eq("user_id", appointment.donor_user_id)
      .maybeSingle();
    const request = await loadRequest(appointment.request_id);

    rows.push({
      ...appointmentView(appointment, { request, donor }),
      // Staff need the real name and number: the donor is attending in person
      // and has to be identified against the booking.
      donorName: profile?.name || "Donor",
      donorPhone: profile?.phone || null,
      donorBloodGroup: donor?.blood_group || null,
      eligibility: eligibility(donor?.last_donation_date),
      forPatientAt: request?.hospital_name || null,
    });
  }

  res.json({ status, appointments: rows });
}

/**
 * POST /api/appointments/:id/confirm — the facility records what happened.
 * A completed donation resets the donor's eligibility clock and credits their
 * reliability; a no-show counts against it.
 */
export async function confirmAppointment(req, res) {
  const outcome = req.body?.outcome;
  if (!["completed", "no_show"].includes(outcome)) {
    return res.status(400).json({ error: "Outcome must be 'completed' or 'no_show'" });
  }

  const { data: appointment } = await supabase
    .from("appointments")
    .select("*")
    .eq("id", req.params.id)
    .maybeSingle();

  if (!appointment) return res.status(404).json({ error: "Booking not found" });

  const isStaffHere = req.user.role === "facility" && req.user.facilityId === appointment.facility_id;
  if (!isStaffHere && req.user.role !== "admin") {
    return res.status(403).json({ error: "Only staff at this facility can confirm a donation" });
  }
  if (appointment.status !== "booked") {
    return res.status(400).json({ error: "This booking has already been closed out" });
  }

  await supabase
    .from("appointments")
    .update({
      status: outcome,
      confirmed_by: req.user.id,
      confirmed_at: new Date().toISOString(),
      note: String(req.body?.note || "").trim() || null,
    })
    .eq("id", appointment.id);

  const { data: donor } = await supabase
    .from("donors")
    .select("*")
    .eq("user_id", appointment.donor_user_id)
    .maybeSingle();

  if (donor) {
    const update =
      outcome === "completed"
        ? {
            donations_confirmed: (donor.donations_confirmed || 0) + 1,
            last_donation_date: new Date().toISOString().slice(0, 10),
          }
        : { no_shows: (donor.no_shows || 0) + 1 };
    await supabase.from("donors").update(update).eq("user_id", donor.user_id);
  }

  // Mirror onto the response so the requester's board stays truthful.
  await supabase
    .from("responses")
    .update({ outcome: outcome === "completed" ? "donated" : "no_show" })
    .eq("id", appointment.response_id);

  const request = await loadRequest(appointment.request_id);

  await notifyInApp({
    userId: appointment.donor_user_id,
    type: outcome === "completed" ? "thanks" : "status",
    title: outcome === "completed" ? "Donation recorded — thank you" : "Marked as a no-show",
    body:
      outcome === "completed"
        ? "The blood bank confirmed your donation. Your eligibility clock has been reset to today."
        : "The blood bank recorded that you did not attend your slot. If this is wrong, report it from the request.",
    requestId: appointment.request_id,
  });

  if (request && outcome === "completed") {
    await notifyInApp({
      userId: request.requester_id,
      type: "response",
      title: "A unit was donated for your request",
      body: `A donation for your ${request.blood_group} request was completed and recorded by the blood bank.`,
      requestId: request.id,
    });
  }

  res.json({ ok: true, status: outcome });
}
