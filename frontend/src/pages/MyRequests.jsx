import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../services/api.js";
import { usePoll } from "../lib/usePoll.js";
import { timeAgo, timeUntil } from "../lib/format.js";
import { BloodTag, EmptyState, ErrorBanner, PageHeader, Spinner, UrgencyChip, VerifiedBadge } from "../components/ui.jsx";

const STATUS_CHIP = {
  open: "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300",
  fulfilled: "bg-sky-100 dark:bg-sky-500/15 text-sky-800 dark:text-sky-300",
  closed: "bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300",
  removed: "bg-blood-100 dark:bg-blood-500/15 text-blood-800 dark:text-blood-300",
};

export default function MyRequests() {
  const { token } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await api("/api/requests/mine", { token });
      setRequests(data.requests);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  usePoll(load, 30000); // live response counts, paused when the tab is hidden

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="My requests"
        subtitle="Live status of everyone you have alerted."
        actions={<Link to="/requests/new" className="btn-primary">Post a request</Link>}
      />

      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      {loading ? (
        <Spinner />
      ) : requests.length === 0 ? (
        <EmptyState
          title="You have not posted a request yet"
          action={<Link to="/requests/new" className="btn-primary">Post a request</Link>}
        >
          A request reaches every compatible, eligible donor in range within seconds.
        </EmptyState>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => (
            <Link key={request.id} to={`/requests/${request.id}`} className="card-interactive block p-5">
              <div className="flex flex-wrap items-start gap-4">
                <BloodTag group={request.bloodGroup} size="lg" />
                <div className="min-w-56 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <UrgencyChip urgency={request.urgency} />
                    <span className={`chip ${STATUS_CHIP[request.status]}`}>{request.status}</span>
                    <VerifiedBadge verified={request.verified} />
                  </div>
                  <h3 className="mt-2 text-base font-semibold text-stone-900 dark:text-stone-50">
                    {request.unitsNeeded} unit{request.unitsNeeded === 1 ? "" : "s"} · {request.hospitalName}
                  </h3>
                  <p className="mt-0.5 text-sm text-stone-500 dark:text-stone-400">
                    Posted {timeAgo(request.createdAt)}
                    {request.neededBy && <> · needed {timeUntil(request.neededBy)}</>}
                  </p>
                </div>

                <dl className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-stone-400 dark:text-stone-500">Alerted</dt>
                    <dd className="text-xl font-bold tabular-nums text-stone-800 dark:text-stone-100">{request.stats.alerted}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-stone-400 dark:text-stone-500">Available</dt>
                    <dd className="text-xl font-bold tabular-nums text-emerald-700 dark:text-emerald-300">{request.stats.available}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-stone-400 dark:text-stone-500">Awaiting</dt>
                    <dd className="text-xl font-bold tabular-nums text-amber-600">
                      {request.stats.alerted - request.stats.responded}
                    </dd>
                  </div>
                </dl>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
