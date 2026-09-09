// Geo + eligibility + reliability matching.
//
// The distance query itself runs in the database: PostGIS ST_DWithin against a
// GiST index in a real project, the equivalent haversine sweep in mock mode.
// Everything after that — compatibility, eligibility, ranking — is applied here
// so the rules live in one readable place.
import { supabase } from "./supabase.js";
import { compatibleDonorGroups } from "./blood.js";
import { eligibility, isAlertable } from "./eligibility.js";
import { reliabilityView } from "./reliability.js";
import { maskName, maskPhone, maskEmail, fuzzLatLng } from "./privacy.js";

export const DEFAULT_RADIUS_KM = 15;
export const MAX_RADIUS_KM = 100;

export function clampRadius(value) {
  const km = Number(value);
  if (!Number.isFinite(km) || km <= 0) return DEFAULT_RADIUS_KM;
  return Math.min(km, MAX_RADIUS_KM);
}

/**
 * Rank = distance first, with a nudge for reliability. A donor 1km away always
 * beats one 12km away, but between two similar distances the one who actually
 * turns up is alerted first.
 */
function rankScore(distanceKm, score) {
  return distanceKm - (score / 100) * 2.5;
}

/**
 * Donors who can give to `bloodGroup`, are within `radiusKm`, and are currently
 * eligible to donate. Contact details come back masked; callers that have
 * earned the real thing go through contactController.
 */
export async function findMatchingDonors({ bloodGroup, lat, lng, radiusKm, excludeUserId, includeIneligible = false }) {
  const groups = compatibleDonorGroups(bloodGroup);
  if (!groups.length) return [];

  const { data, error } = await supabase.rpc("match_donors", {
    p_lat: Number(lat),
    p_lng: Number(lng),
    p_radius_km: clampRadius(radiusKm),
    p_groups: groups,
  });
  if (error) throw new Error(error.message);

  const now = new Date();

  return (data || [])
    .filter((row) => row.user_id !== excludeUserId)
    .map((row) => {
      const elig = eligibility(row.last_donation_date, now);
      const reliability = reliabilityView(row);
      const fuzzed = fuzzLatLng(row.lat, row.lng);
      return {
        userId: row.user_id,
        displayName: maskName(row.name),
        bloodGroup: row.blood_group,
        areaLabel: row.area_label,
        distanceKm: Math.round(row.distance_km * 10) / 10,
        contactPref: row.contact_pref,
        maskedPhone: maskPhone(row.phone),
        maskedEmail: maskEmail(row.email),
        paused: Boolean(row.paused),
        eligible: elig.eligible,
        eligibleOn: elig.eligibleOn,
        daysUntilEligible: elig.daysRemaining,
        alertable: isAlertable({ paused: row.paused, last_donation_date: row.last_donation_date }, now),
        reliability,
        approxLat: fuzzed.lat,
        approxLng: fuzzed.lng,
        // Kept out of the API response — dispatch needs it, serialisers drop it.
        _contact: { email: row.email, phone: row.phone },
      };
    })
    .filter((d) => (includeIneligible ? true : d.alertable))
    .sort((a, b) => rankScore(a.distanceKm, a.reliability.score) - rankScore(b.distanceKm, b.reliability.score));
}

/** Strip the internal contact bag before anything reaches the wire. */
export function publicDonor(match) {
  const { _contact, ...rest } = match;
  return rest;
}
