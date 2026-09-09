// Donation eligibility: the standard minimum gap between whole-blood donations.
// Configurable so a deployment can follow its own national guideline
// (India/WHO use 90 days for men and women alike for whole blood).

export const MIN_DONATION_GAP_DAYS = Number(process.env.DONATION_GAP_DAYS || 90);

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Eligibility view for a donor, derived purely from their last donation date.
 * A donor who has never donated (or has no recorded date) is eligible.
 */
export function eligibility(lastDonationDate, now = new Date()) {
  if (!lastDonationDate) {
    return { eligible: true, eligibleOn: null, daysRemaining: 0, lastDonationDate: null };
  }

  const last = startOfDay(lastDonationDate);
  if (Number.isNaN(last.getTime())) {
    return { eligible: true, eligibleOn: null, daysRemaining: 0, lastDonationDate: null };
  }

  const eligibleOn = new Date(last.getTime() + MIN_DONATION_GAP_DAYS * DAY_MS);
  const daysRemaining = Math.ceil((eligibleOn - startOfDay(now)) / DAY_MS);

  return {
    eligible: daysRemaining <= 0,
    eligibleOn: eligibleOn.toISOString().slice(0, 10),
    daysRemaining: Math.max(0, daysRemaining),
    lastDonationDate: last.toISOString().slice(0, 10),
  };
}

/** A donor is alertable when they are past the gap AND have not paused themselves. */
export function isAlertable(donor, now = new Date()) {
  if (!donor || donor.paused) return false;
  return eligibility(donor.last_donation_date, now).eligible;
}
