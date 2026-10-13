import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../services/api.js";
import { usePoll } from "../lib/usePoll.js";
import { formatDateTime, timeAgo } from "../lib/format.js";
import {
  BloodTag, EligibilityPill, EmptyState, ErrorBanner, Notice, PageHeader, Spinner,
} from "../components/ui.jsx";

const TABS = [
  ["booked", "Expected"],
  ["completed", "Donated"],
  ["no_show", "No-shows"],
  ["cancelled", "Cancelled"],
];

/**
 * The blood bank's desk. Staff confirm who actually donated — they are the only
 * party who witnessed it, which is why this is not the requester's job.
 */
export default function FacilityDesk() {
  const { token, user } = useAuth();
  const [status, setStatus] = useState("booked");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await api(`/api/facility/appointments?status=${status}`, { token });
      setRows(data.appointments);
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [token, status]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  usePoll(load, 30000);

  async function record(id, outcome) {
    setBusy(id);
    setError(null);
    try {
      await api(`/api/appointments/${id}/confirm`, { method: "POST", token, body: { outcome } });
      await load();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Donation desk"
        subtitle={user.organization || "Bookings at your facility"}
        actions={
          <div className="flex flex-wrap gap-1 rounded-xl bg-stone-200/60 p-1 dark:bg-stone-800/60">
            {TABS.map(([value, label]) => (
              <button
                key={value}
                onClick={() => setStatus(value)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                  status === value
                    ? "bg-white text-stone-900 shadow-sm dark:bg-stone-900 dark:text-stone-50"
                    : "text-stone-600 hover:text-stone-900 dark:text-stone-300 dark:hover:text-stone-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        }
      />

      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      <div className="mb-4">
        <Notice tone="info">
          Check photo ID against the name below before drawing. Recording a donation here resets that donor's
          90-day eligibility and credits their record — the requester cannot do it on your behalf.
        </Notice>
      </div>

      {loading ? (
        <Spinner rows={2} />
      ) : rows.length === 0 ? (
        <EmptyState title={`Nothing ${TABS.find(([v]) => v === status)[1].toLowerCase()}`}>
          Bookings made by donors for requests near you appear here.
        </EmptyState>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <article key={row.id} className="card p-5">
              <div className="flex flex-wrap items-start gap-4">
                <BloodTag group={row.donorBloodGroup || row.bloodGroup} size="lg" />

                <div className="min-w-56 flex-1">
                  <p className="text-base font-semibold text-stone-900 dark:text-stone-50">{row.donorName}</p>
                  <p className="mt-0.5 text-sm text-stone-600 dark:text-stone-300">
                    <a href={`tel:${row.donorPhone}`} className="font-medium underline">{row.donorPhone}</a>
                  </p>
                  <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
                    {formatDateTime(row.scheduledAt)}
                    {row.forPatientAt && <> · for the request at {row.forPatientAt}</>}
                  </p>
                  {row.confirmedAt && (
                    <p className="hint">Recorded {timeAgo(row.confirmedAt)}</p>
                  )}
                </div>

                <EligibilityPill eligibility={row.eligibility} />
              </div>

              {row.status === "booked" && (
                <div className="mt-4 flex flex-wrap gap-2 border-t border-stone-100 pt-4 dark:border-stone-800">
                  <button
                    className="btn-success"
                    onClick={() => record(row.id, "completed")}
                    disabled={busy !== null || !row.eligibility?.eligible}
                    title={row.eligibility?.eligible ? undefined : "This donor is inside the donation gap"}
                  >
                    {busy === row.id ? "Recording…" : "Donation completed"}
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={() => record(row.id, "no_show")}
                    disabled={busy !== null}
                  >
                    Did not attend
                  </button>
                </div>
              )}

              {!row.eligibility?.eligible && row.status === "booked" && (
                <p className="mt-3 rounded-xl bg-amber-50 px-4 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                  This donor is inside their donation gap and should be turned away — do not draw.
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
