import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../services/api.js";
import { ErrorBanner, PageHeader, Spinner, StatTile } from "../components/ui.jsx";

export default function AdminOverview() {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api("/api/admin/overview", { token }).then(setData).catch(setError);
  }, [token]);

  if (error) return <ErrorBanner error={error} />;
  if (!data) return <Spinner />;

  const { totals, byGroup, topDonors } = data;
  const maxGroup = Math.max(1, ...Object.values(byGroup).map((g) => g.total));

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Network overview" subtitle="The health of the donor pool at a glance." />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Registered donors"
          value={totals.donors}
          sub={`${totals.eligibleDonors} eligible right now`}
        />
        <StatTile label="Open requests" value={totals.openRequests} tone="blood" />
        <StatTile label="Fulfilled" value={totals.fulfilledRequests} tone="good" />
        <StatTile
          label="Open reports"
          value={totals.openReports}
          tone={totals.openReports ? "warn" : "default"}
          sub={totals.openReports ? "Needs a moderator" : "Queue is clear"}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
            Donor pool by blood group
          </h2>
          <p className="hint">Solid bar = eligible today. Faded = inside the 90-day gap or paused.</p>
          <ul className="mt-4 space-y-3">
            {Object.entries(byGroup)
              .sort((a, b) => b[1].total - a[1].total)
              .map(([group, counts]) => (
                <li key={group} className="flex items-center gap-3">
                  <span className="w-10 shrink-0 text-sm font-bold text-blood-700 dark:text-blood-300">{group}</span>
                  <div className="h-3 flex-1 overflow-hidden rounded-full bg-stone-100 dark:bg-stone-800">
                    <div className="flex h-full" style={{ width: `${(counts.total / maxGroup) * 100}%` }}>
                      <div
                        className="h-full bg-blood-600"
                        style={{ width: `${(counts.eligible / Math.max(1, counts.total)) * 100}%` }}
                      />
                      <div className="h-full flex-1 bg-blood-200" />
                    </div>
                  </div>
                  <span className="w-16 shrink-0 text-right text-xs tabular-nums text-stone-500 dark:text-stone-400">
                    {counts.eligible}/{counts.total}
                  </span>
                </li>
              ))}
          </ul>
        </section>

        <section className="card p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">Most active donors</h2>
          <ul className="mt-4 space-y-3">
            {topDonors.map((donor, i) => (
              <li key={donor.userId} className="flex items-center gap-3 border-t border-stone-100 dark:border-stone-800 pt-3 first:border-0 first:pt-0">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-stone-100 dark:bg-stone-800 text-xs font-bold text-stone-600 dark:text-stone-300">
                  {i + 1}
                </span>
                <span className="w-10 text-sm font-bold text-blood-700 dark:text-blood-300">{donor.bloodGroup}</span>
                <span className="flex-1 text-sm text-stone-600 dark:text-stone-300">
                  {donor.donationsConfirmed} donation{donor.donationsConfirmed === 1 ? "" : "s"} ·{" "}
                  {donor.responseRate ?? 0}% answered
                </span>
                <span className="text-sm font-semibold tabular-nums text-stone-800 dark:text-stone-100">{donor.score}</span>
              </li>
            ))}
          </ul>

          <div className="mt-5 flex gap-2 border-t border-stone-100 dark:border-stone-800 pt-4">
            <Link to="/admin/reports" className="btn-secondary">Moderation queue</Link>
            <Link to="/admin/verifications" className="btn-secondary">Verification queue</Link>
          </div>
        </section>
      </div>
    </div>
  );
}
