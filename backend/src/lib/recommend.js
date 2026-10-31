// Which blood bank should this donor actually go to?
//
// Listing facilities by distance from the hospital answers the wrong question.
// The donor is the one travelling, and they are choosing between places that
// differ in more than distance: one may be shut, one may have nothing free
// until Thursday, and one may be the bank that actually serves the patient's
// hospital. This ranks on all of that and says why, rather than producing an
// opaque score.
import { haversineKm, roundKm } from "./geo.js";
import { slotsForDay, upcomingSlots } from "./slots.js";

const DAY_MS = 24 * 60 * 60 * 1000;

function toMinutes(t) {
  const [h, m] = String(t || "09:00").split(":").map(Number);
  return (Number.isFinite(h) ? h : 9) * 60 + (Number.isFinite(m) ? m : 0);
}

export function isOpenNow(facility, now = new Date()) {
  const minute = now.getHours() * 60 + now.getMinutes();
  return minute >= toMinutes(facility.open_time) && minute < toMinutes(facility.close_time);
}

/**
 * Build the decision view for one facility.
 * `taken` is that facility's existing bookings.
 */
export function facilityDecision(facility, { donorPoint, requestPoint, isRequestFacility, taken = [], now = new Date() }) {
  const days = upcomingSlots(facility, taken, 5, now);
  const firstDay = days[0];
  const nextSlot = firstDay?.slots.find((s) => !s.full) || null;

  const todayKey = new Date(now).toISOString().slice(0, 10);
  const slotsToday = firstDay && firstDay.date === todayKey
    ? firstDay.slots.filter((s) => !s.full).length
    : 0;

  const fromYou = donorPoint ? roundKm(haversineKm(donorPoint.lat, donorPoint.lng, facility.lat, facility.lng)) : null;
  const fromRequest = requestPoint ? roundKm(haversineKm(requestPoint.lat, requestPoint.lng, facility.lat, facility.lng)) : null;

  // Lower is better. Distance the donor travels dominates; the rest adjusts it.
  let score = fromYou ?? 50;
  const reasons = [];

  if (isRequestFacility) {
    score -= 8;
    reasons.push("Serves the patient's hospital");
  }
  if (nextSlot && new Date(nextSlot.at) - now < 6 * 60 * 60 * 1000) {
    score -= 4;
    reasons.push("Has a slot in the next few hours");
  } else if (!nextSlot) {
    score += 40;
    reasons.push("Nothing bookable in the next few days");
  }
  if (isOpenNow(facility, now)) {
    score -= 2;
    reasons.push("Open right now");
  }
  if (fromYou != null && fromYou <= 3) {
    score -= 2;
    reasons.push("Close to you");
  }
  if (facility.slot_capacity >= 3) {
    reasons.push("Rarely full");
  }

  return {
    distanceFromYouKm: fromYou,
    distanceFromRequestKm: fromRequest,
    openNow: isOpenNow(facility, now),
    opensAt: String(facility.open_time).slice(0, 5),
    closesAt: String(facility.close_time).slice(0, 5),
    slotsToday,
    nextSlotAt: nextSlot?.at || null,
    nextSlotLabel: nextSlot ? `${firstDay.label}, ${nextSlot.label}` : null,
    isRequestFacility: Boolean(isRequestFacility),
    reasons,
    score,
  };
}

/** Marks the single best option, so the donor is given an answer not a list. */
export function rankFacilities(rows) {
  const sorted = [...rows].sort((a, b) => a.score - b.score);
  return sorted.map((row, i) => ({ ...row, recommended: i === 0 && row.nextSlotAt != null }));
}

export { slotsForDay, DAY_MS };
