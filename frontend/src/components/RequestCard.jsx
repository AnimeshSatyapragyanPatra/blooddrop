import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { distance, timeAgo, timeUntil } from "../lib/format.js";
import { BloodTag, UrgencyChip, VerifiedBadge, ResponseChip, ErrorBanner } from "./ui.jsx";
import ReportDialog from "./ReportDialog.jsx";

/**
 * One open request as a donor sees it: what is needed, how far, who is asking,
 * and the two buttons that turn silence into a status.
 */
export default function RequestCard({ request, onResponded }) {
  const { token, donor } = useAuth();
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [reporting, setReporting] = useState(false);
  const [contact, setContact] = useState(null);

  const answered = Boolean(request.myResponse);
  const accepted = request.myResponse?.status === "available";
  const ineligible = donor && !donor.eligibility.eligible;

  async function respond(status) {
    setBusy(status);
    setError(null);
    try {
      await api(`/api/requests/${request.id}/respond`, { method: "POST", token, body: { status } });
      await onResponded?.();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(null);
    }
  }

  async function revealContact() {
    setBusy("contact");
    setError(null);
    try {
      const data = await api(`/api/requests/${request.id}/contact`, { token });
      setContact(data.contact);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(null);
    }
  }

  // A coloured edge so urgency registers before any text is read.
  const edge = {
    critical: "border-l-4 border-l-blood-600",
    urgent: "border-l-4 border-l-amber-500",
    routine: "border-l-4 border-l-sky-400",
  }[request.urgency] || "";

  return (
    <article className={`card overflow-hidden ${edge}`}>
      <div className="flex flex-wrap items-start gap-4 p-5">
        <BloodTag group={request.bloodGroup} size="lg" />

        <div className="min-w-56 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <UrgencyChip urgency={request.urgency} />
            <VerifiedBadge verified={request.requester?.verified} organization={request.requester?.organization} />
            {answered && <ResponseChip status={request.myResponse.status} />}
          </div>

          <h3 className="mt-2 text-base font-semibold text-stone-900 dark:text-stone-50">
            {request.unitsNeeded} unit{request.unitsNeeded === 1 ? "" : "s"} of {request.bloodGroup} ·{" "}
            {request.hospitalName}
          </h3>
          <p className="mt-0.5 text-sm text-stone-500 dark:text-stone-400">
            {request.areaLabel || "Location on map"}
            {request.distanceKm != null && <> · {distance(request.distanceKm)} away</>}
            {request.neededBy && <> · needed {timeUntil(request.neededBy)}</>}
          </p>
          {request.notes && <p className="mt-2 text-sm text-stone-600 dark:text-stone-300">{request.notes}</p>}
          <p className="mt-2 text-xs text-stone-400 dark:text-stone-500">
            Posted by {request.requester?.displayName || "a requester"} · {timeAgo(request.createdAt)}
          </p>
        </div>
      </div>

      {error && (
        <div className="px-5">
          <ErrorBanner error={error} onDismiss={() => setError(null)} />
        </div>
      )}

      {contact && (
        <div className="mx-5 mb-4 rounded-xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 p-4 text-sm">
          <p className="font-semibold text-emerald-900 dark:text-emerald-200">{contact.name}</p>
          <p className="mt-1 text-emerald-800 dark:text-emerald-300">
            <a href={`tel:${contact.phone}`} className="font-semibold underline">{contact.phone}</a>
            {contact.email && <> · {contact.email}</>}
          </p>
          <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
            Shared with you because you accepted. They have been told you viewed it.
          </p>
        </div>
      )}

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 dark:border-stone-800 bg-stone-50 dark:bg-stone-900 px-5 py-3">
        <div className="flex flex-wrap gap-2">
          {!answered && (
            <>
              <button
                className="btn-success"
                onClick={() => respond("available")}
                disabled={busy !== null || ineligible}
                title={ineligible ? "You are inside the donation gap" : undefined}
              >
                {busy === "available" ? "Sending…" : "I'm available"}
              </button>
              <button className="btn-secondary" onClick={() => respond("unavailable")} disabled={busy !== null}>
                {busy === "unavailable" ? "Sending…" : "Can't make it"}
              </button>
            </>
          )}

          {/* Blood is collected at a licensed facility, so an accepted alert leads
              to a booked slot there. The requester's number stays available as a
              fallback for requests posted without a registered facility. */}
          {accepted && request.facilityId && (
            <Link to={`/requests/${request.id}/book`} className="btn-primary">
              Book your donation slot
            </Link>
          )}

          {accepted && !request.facilityId && !contact && (
            <button className="btn-primary" onClick={revealContact} disabled={busy !== null}>
              {busy === "contact" ? "Unlocking…" : "Show requester's contact"}
            </button>
          )}

          {answered && !accepted && (
            <button className="btn-secondary" onClick={() => respond("available")} disabled={busy !== null || ineligible}>
              Change to available
            </button>
          )}

          <Link to={`/requests/${request.id}`} className="btn-ghost">
            Details
          </Link>
        </div>

        <button className="text-xs font-medium text-stone-500 dark:text-stone-400 hover:text-blood-700 dark:hover:text-blood-300" onClick={() => setReporting(true)}>
          Report this request
        </button>
      </footer>

      {ineligible && !answered && (
        <p className="border-t border-stone-100 dark:border-stone-800 bg-amber-50 dark:bg-amber-500/10 px-5 py-2 text-xs text-amber-800 dark:text-amber-300">
          You can still say you cannot make it — accepting is disabled until your {donor.eligibility.daysRemaining}-day
          wait is over.
        </p>
      )}

      {reporting && (
        <ReportDialog targetType="request" targetId={request.id} onClose={() => setReporting(false)} />
      )}
    </article>
  );
}
