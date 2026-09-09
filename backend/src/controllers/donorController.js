import { supabase } from "../lib/supabase.js";
import { isBloodGroup } from "../lib/blood.js";
import { isLatLng } from "../lib/geo.js";
import { findMatchingDonors, publicDonor, clampRadius } from "../lib/matching.js";
import { donorView } from "../lib/views.js";

const CONTACT_PREFS = ["inapp", "email", "sms"];

export async function getMyDonorProfile(req, res) {
  const { data } = await supabase.from("donors").select("*").eq("user_id", req.user.id).maybeSingle();
  res.json({ donor: donorView(data) });
}

/** Create or update the caller's donor record (also promotes a requester to donor). */
export async function upsertMyDonorProfile(req, res) {
  const { bloodGroup, lat, lng, areaLabel, lastDonationDate, contactPref } = req.body || {};

  if (!isBloodGroup(bloodGroup)) return res.status(400).json({ error: "Choose a valid blood group" });
  if (!isLatLng(Number(lat), Number(lng))) {
    return res.status(400).json({ error: "Set your location on the map so we can match you by distance" });
  }
  if (lastDonationDate && Number.isNaN(Date.parse(lastDonationDate))) {
    return res.status(400).json({ error: "Last donation date is not a valid date" });
  }
  if (lastDonationDate && new Date(lastDonationDate) > new Date()) {
    return res.status(400).json({ error: "Last donation date cannot be in the future" });
  }

  const { data, error } = await supabase
    .from("donors")
    .upsert(
      {
        user_id: req.user.id,
        blood_group: bloodGroup,
        lat: Number(lat),
        lng: Number(lng),
        area_label: String(areaLabel || "").trim() || null,
        last_donation_date: lastDonationDate || null,
        contact_pref: CONTACT_PREFS.includes(contactPref) ? contactPref : "inapp",
      },
      { onConflict: "user_id" }
    )
    .select("*")
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ donor: donorView(data) });
}

/** The donor's own "pause alerts" switch, separate from the 90-day rule. */
export async function setPaused(req, res) {
  const paused = Boolean(req.body?.paused);
  const { data, error } = await supabase
    .from("donors")
    .update({ paused })
    .eq("user_id", req.user.id)
    .select("*")
    .single();

  if (error) return res.status(404).json({ error: "Register as a donor first" });
  res.json({ donor: donorView(data) });
}

/**
 * Distance-sorted donor search. Contact details are masked for everyone —
 * reaching a donor happens by dispatching an alert, never by scraping a list.
 */
export async function searchDonors(req, res) {
  const { bloodGroup, lat, lng, radiusKm, includeIneligible } = req.query;

  if (!isBloodGroup(bloodGroup)) return res.status(400).json({ error: "Choose a valid blood group" });
  if (!isLatLng(Number(lat), Number(lng))) return res.status(400).json({ error: "A search location is required" });

  try {
    const matches = await findMatchingDonors({
      bloodGroup,
      lat: Number(lat),
      lng: Number(lng),
      radiusKm: clampRadius(radiusKm),
      excludeUserId: req.user.id,
      includeIneligible: includeIneligible === "1",
    });

    res.json({
      radiusKm: clampRadius(radiusKm),
      bloodGroup,
      count: matches.length,
      donors: matches.map(publicDonor),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
