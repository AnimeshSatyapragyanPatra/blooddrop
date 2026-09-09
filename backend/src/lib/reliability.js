// Donor reliability score — used to decide who gets alerted first, and shown
// to requesters so a wall of anonymous names becomes a ranked shortlist.
//
// Two signals, both smoothed with a prior so a brand-new donor is not punished
// for having no history (they start at a neutral 50, not 0):
//   response rate — of the alerts sent to them, how many did they answer at all
//   show rate     — of the times they said yes, how many donations were confirmed
// A small bonus rewards a track record of completed donations.

const RESPONSE_PRIOR = { hits: 2, total: 4 }; // = 0.5
const SHOW_PRIOR = { hits: 1, total: 2 }; // = 0.5
const BONUS_CAPS_AT = 5; // confirmed donations

export function reliabilityScore(stats = {}) {
  const alerts = stats.alerts_received || 0;
  const responses = stats.responses_given || 0;
  const donations = stats.donations_confirmed || 0;
  const noShows = stats.no_shows || 0;

  const responseRate = (responses + RESPONSE_PRIOR.hits) / (alerts + RESPONSE_PRIOR.total);
  const showRate = (donations + SHOW_PRIOR.hits) / (donations + noShows + SHOW_PRIOR.total);
  const bonus = Math.min(donations, BONUS_CAPS_AT) / BONUS_CAPS_AT;

  const score = 100 * (0.45 * responseRate + 0.45 * showRate + 0.1 * bonus);
  return Math.round(Math.max(0, Math.min(100, score)));
}

/** Public, non-numeric summary — kept alongside the score so the UI can label it. */
export function reliabilityView(stats = {}) {
  const alerts = stats.alerts_received || 0;
  const responses = stats.responses_given || 0;
  const score = reliabilityScore(stats);

  return {
    score,
    isNew: alerts < 3,
    tier: score >= 80 ? "high" : score >= 55 ? "medium" : "low",
    alertsReceived: alerts,
    responsesGiven: responses,
    donationsConfirmed: stats.donations_confirmed || 0,
    noShows: stats.no_shows || 0,
    responseRate: alerts ? Math.round((responses / alerts) * 100) : null,
  };
}
