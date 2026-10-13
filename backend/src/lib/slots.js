// Bookable slot generation.
//
// A facility advertises one opening window per day, a slot length and a
// capacity. Slots are derived from those rather than stored, so a facility
// changing its hours does not need a migration or a backfill — only existing
// bookings are rows.

const DAY_MS = 24 * 60 * 60 * 1000;

/** "09:00" / "09:00:00" -> minutes past midnight. */
function toMinutes(time) {
  const [h, m] = String(time || "09:00").split(":").map(Number);
  return (Number.isFinite(h) ? h : 9) * 60 + (Number.isFinite(m) ? m : 0);
}

export function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Every slot a facility offers on `date`, with how many places remain.
 * Slots already in the past are dropped — offering 9am at 4pm helps nobody.
 */
export function slotsForDay(facility, date, taken = [], now = new Date()) {
  const day = startOfDay(date);
  const open = toMinutes(facility.open_time);
  const close = toMinutes(facility.close_time);
  const length = facility.slot_minutes || 30;
  const capacity = facility.slot_capacity || 1;

  // Count existing bookings per slot start.
  const used = new Map();
  for (const appointment of taken) {
    if (appointment.status === "cancelled") continue;
    const key = new Date(appointment.scheduled_at).toISOString();
    used.set(key, (used.get(key) || 0) + 1);
  }

  const slots = [];
  for (let minute = open; minute + length <= close; minute += length) {
    const at = new Date(day.getTime() + minute * 60000);
    if (at <= now) continue;

    const key = at.toISOString();
    const booked = used.get(key) || 0;
    slots.push({
      at: key,
      label: at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      remaining: Math.max(0, capacity - booked),
      full: booked >= capacity,
    });
  }
  return slots;
}

/** The next `days` days a facility can be booked for, slots included. */
export function upcomingSlots(facility, taken = [], days = 5, now = new Date()) {
  const out = [];
  for (let i = 0; i < days; i += 1) {
    const date = new Date(startOfDay(now).getTime() + i * DAY_MS);
    const slots = slotsForDay(facility, date, taken, now);
    if (slots.length) {
      out.push({
        date: date.toISOString().slice(0, 10),
        label: date.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" }),
        slots,
      });
    }
  }
  return out;
}

/** Is `isoTime` a real, still-free slot at this facility? */
export function isBookable(facility, isoTime, taken = [], now = new Date()) {
  const at = new Date(isoTime);
  if (Number.isNaN(at.getTime())) return { ok: false, reason: "That is not a valid time." };
  if (at <= now) return { ok: false, reason: "That slot is in the past." };

  const slots = slotsForDay(facility, at, taken, now);
  const match = slots.find((s) => s.at === at.toISOString());
  if (!match) return { ok: false, reason: "That time is not one of this facility's slots." };
  if (match.full) return { ok: false, reason: "That slot is fully booked. Please pick another." };
  return { ok: true };
}
