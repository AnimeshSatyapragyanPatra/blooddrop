// What a blood collection costs, and who is owed it.
//
// Two parties are paid and the donor is neither of them. Indian law bars
// paying a donor for blood — the Drugs and Cosmetics Rules define a
// professional donor as one who gives blood "for valuable consideration, in
// cash or kind" — so nothing in this module can produce an amount payable to
// a donor. The money is:
//
//   processing fee  requester -> licensed facility, per unit, for collecting,
//                   testing, typing, storing and issuing the blood
//   platform fee    requester -> BloodDrop, for running the service
//
// They are quoted separately rather than as one number, so the requester can
// see what the facility charges and what we charge.

/** Our commission, in basis points of the facility's processing charge. */
export const PLATFORM_FEE_BPS = clampInt(process.env.PLATFORM_FEE_BPS, 0, 2000, 500);

/** A ceiling, so a large multi-unit order does not scale our cut without limit. */
export const PLATFORM_FEE_CAP_PAISE = clampInt(process.env.PLATFORM_FEE_CAP_PAISE, 0, 2000000, 25000);

/** Below this, charging at all costs more in reconciliation than it collects. */
export const PLATFORM_FEE_MIN_PAISE = clampInt(process.env.PLATFORM_FEE_MIN_PAISE, 0, 100000, 0);

function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(Math.round(n), min), max);
}

/**
 * Price one booking.
 *
 * Everything is integer paise. Currency in floating point accumulates error
 * the moment it is summed, and these numbers are quoted to a person.
 */
export function quote({ processingFeePaise = 0, units = 1, bps = PLATFORM_FEE_BPS } = {}) {
  const unitCount = clampInt(units, 1, 20, 1);
  const perUnit = clampInt(processingFeePaise, 0, 2000000, 0);
  const processing = perUnit * unitCount;

  // A facility that charges nothing — a camp, a waiver — is not a billable
  // event for us either. We take a share of a charge, not a toll on access.
  let platform = 0;
  if (processing > 0) {
    platform = Math.round((processing * clampInt(bps, 0, 2000, PLATFORM_FEE_BPS)) / 10000);
    platform = Math.min(platform, PLATFORM_FEE_CAP_PAISE);
    if (platform < PLATFORM_FEE_MIN_PAISE) platform = PLATFORM_FEE_MIN_PAISE;
  }

  return {
    units: unitCount,
    perUnitPaise: perUnit,
    processingFeePaise: processing,
    platformFeePaise: platform,
    totalPaise: processing + platform,
    platformFeeBps: clampInt(bps, 0, 2000, PLATFORM_FEE_BPS),
    // Stated on every quote, so the UI cannot show a total without it.
    donorPaidPaise: 0,
  };
}

/** "₹1,550.00" — paise in, rupees out, for display only. */
export function formatPaise(paise) {
  const n = Number(paise) || 0;
  return "₹" + (n / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** The shape the API hands to the client. */
export function quoteView(q) {
  return {
    units: q.units,
    perUnit: formatPaise(q.perUnitPaise),
    processingFee: formatPaise(q.processingFeePaise),
    platformFee: formatPaise(q.platformFeePaise),
    total: formatPaise(q.totalPaise),
    perUnitPaise: q.perUnitPaise,
    processingFeePaise: q.processingFeePaise,
    platformFeePaise: q.platformFeePaise,
    totalPaise: q.totalPaise,
    platformFeePercent: q.platformFeeBps / 100,
    donorReceives: formatPaise(0),
    note: "Paid to the licensed facility and to BloodDrop. A donor is never paid for blood.",
  };
}
