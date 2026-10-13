// Facilities are the licensed places a donation can happen. Blood cannot pass
// from a donor to a patient directly — it has to be collected, screened and
// cross-matched somewhere accountable — so these are the only places a slot
// can be booked and the only people who may confirm a donation took place.
import { supabase } from "../lib/supabase.js";
import { haversineKm, isLatLng, roundKm } from "../lib/geo.js";
import { upcomingSlots } from "../lib/slots.js";

const TYPES = ["hospital", "blood_bank"];

export function facilityView(facility, distanceKm) {
  if (!facility) return null;
  return {
    id: facility.id,
    name: facility.name,
    type: facility.type,
    address: facility.address,
    phone: facility.phone,
    lat: facility.lat,
    lng: facility.lng,
    openTime: String(facility.open_time).slice(0, 5),
    closeTime: String(facility.close_time).slice(0, 5),
    slotMinutes: facility.slot_minutes,
    licenceRef: facility.licence_ref,
    verified: Boolean(facility.verified),
    ...(distanceKm != null ? { distanceKm } : {}),
  };
}

/**
 * Verified facilities, nearest first when a location is given.
 *
 * Distance is computed here rather than in PostGIS, unlike donor matching:
 * a region has dozens of facilities but thousands of donors, so an indexed
 * spatial query earns its keep for one and not the other.
 */
export async function listFacilities(req, res) {
  const { data, error } = await supabase
    .from("facilities")
    .select("*")
    .eq("verified", true)
    .order("name", { ascending: true });

  if (error) return res.status(500).json({ error: error.message });

  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const hasPoint = isLatLng(lat, lng);

  let rows = (data || []).map((f) =>
    facilityView(f, hasPoint ? roundKm(haversineKm(lat, lng, f.lat, f.lng)) : null)
  );
  if (hasPoint) rows.sort((a, b) => a.distanceKm - b.distanceKm);

  res.json({ facilities: rows });
}

/** One facility plus the days and times it can actually be booked for. */
export async function getFacilitySlots(req, res) {
  const { data: facility } = await supabase
    .from("facilities")
    .select("*")
    .eq("id", req.params.id)
    .maybeSingle();

  if (!facility) return res.status(404).json({ error: "Facility not found" });
  if (!facility.verified) {
    return res.status(400).json({ error: "This facility is not verified yet, so it cannot take bookings." });
  }

  const { data: taken } = await supabase
    .from("appointments")
    .select("scheduled_at, status")
    .eq("facility_id", facility.id);

  res.json({
    facility: facilityView(facility),
    days: upcomingSlots(facility, taken || []),
  });
}

/** Admin: register a facility. Verification is a separate, deliberate step. */
export async function createFacility(req, res) {
  const { name, type, address, lat, lng, phone, openTime, closeTime, slotMinutes, slotCapacity, licenceRef } =
    req.body || {};

  if (!String(name || "").trim()) return res.status(400).json({ error: "Facility name is required" });
  if (!TYPES.includes(type)) return res.status(400).json({ error: "Type must be 'hospital' or 'blood_bank'" });
  if (!isLatLng(Number(lat), Number(lng))) return res.status(400).json({ error: "Set the facility location" });
  if (!String(licenceRef || "").trim()) {
    return res.status(400).json({ error: "A licence or registration number is required" });
  }

  const { data, error } = await supabase
    .from("facilities")
    .insert({
      name: String(name).trim(),
      type,
      address: String(address || "").trim() || null,
      lat: Number(lat),
      lng: Number(lng),
      phone: String(phone || "").trim() || null,
      open_time: openTime || "09:00",
      close_time: closeTime || "17:00",
      slot_minutes: Number(slotMinutes) || 30,
      slot_capacity: Number(slotCapacity) || 2,
      licence_ref: String(licenceRef).trim(),
      verified: false,
    })
    .select("*")
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ facility: facilityView(data) });
}

/** Admin: a facility only becomes bookable once its licence has been checked. */
export async function verifyFacility(req, res) {
  const approve = req.body?.approve !== false;
  const { data, error } = await supabase
    .from("facilities")
    .update({ verified: approve })
    .eq("id", req.params.id)
    .select("*")
    .single();

  if (error) return res.status(404).json({ error: "Facility not found" });
  res.json({ facility: facilityView(data) });
}
