import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../services/api.js";
import { REASON_LABEL, timeAgo } from "../lib/format.js";
import { EmptyState, ErrorBanner, Notice, PageHeader, Spinner } from "../components/ui.jsx";

const TABS = [
  ["open", "Open"],
  ["resolved", "Actioned"],
  ["dismissed", "Dismissed"],
];

export default function AdminReports() {
  const { token } = useAuth();
  const [status, setStatus] = useState("open");
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notes, setNotes] = useState({});
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api(`/api/admin/reports?status=${status}`, { token });
      setReports(data.reports);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [token, status]);

  useEffect(() => {
    load();
  }, [load]);

  async function resolve(id, action) {
    setBusy(id);
    setError(null);
    try {
      await api(`/api/admin/reports/${id}/resolve`, {
        method: "POST",
        token,
        body: { action, note: notes[id] || "" },
      });
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
        title="Moderation queue"
        subtitle="Flagged requests and users, newest first."
        actions={
          <div className="flex gap-1 rounded-xl bg-stone-200/60 dark:bg-stone-800/60 p-1">
            {TABS.map(([value, label]) => (
              <button
                key={value}
                onClick={() => setStatus(value)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                  status === value ? "bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-50 shadow-sm" : "text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-50"
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
          Removing a request notifies the requester and every donor who responded, so nobody makes a wasted trip.
        </Notice>
      </div>

      {loading ? (
        <Spinner />
      ) : reports.length === 0 ? (
        <EmptyState title={`Nothing ${status}`}>
          {status === "open" ? "The queue is clear." : "No reports in this state."}
        </EmptyState>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => (
            <article key={report.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="chip bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300">{REASON_LABEL[report.reason]}</span>
                    <span className="chip bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300">{report.targetType}</span>
                    {report.target.verified && <span className="chip bg-sky-100 dark:bg-sky-500/15 text-sky-800 dark:text-sky-300">Verified requester</span>}
                  </div>
                  <p className="mt-2 text-base font-semibold text-stone-900 dark:text-stone-50">{report.target.label}</p>
                  {report.details && <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">“{report.details}”</p>}
                  <p className="mt-1 text-xs text-stone-400 dark:text-stone-500">
                    Reported by {report.reportedBy} · {timeAgo(report.createdAt)}
                    {report.target.status && <> · request is {report.target.status}</>}
                  </p>
                </div>
                {report.targetType === "request" && (
                  <Link to={`/requests/${report.targetId}`} className="btn-secondary">
                    Open request
                  </Link>
                )}
              </div>

              {report.status === "open" ? (
                <div className="mt-4 border-t border-stone-100 dark:border-stone-800 pt-4">
                  <label className="label" htmlFor={`note-${report.id}`}>
                    Moderator note <span className="font-normal text-stone-400 dark:text-stone-500">(shown to the people notified)</span>
                  </label>
                  <input
                    id={`note-${report.id}`}
                    className="input"
                    value={notes[report.id] || ""}
                    onChange={(e) => setNotes((n) => ({ ...n, [report.id]: e.target.value }))}
                    placeholder="e.g. hospital confirmed no such patient"
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button className="btn-primary" onClick={() => resolve(report.id, "remove")} disabled={busy !== null}>
                      Remove {report.targetType}
                    </button>
                    <button className="btn-secondary" onClick={() => resolve(report.id, "warn")} disabled={busy !== null}>
                      Warn the poster
                    </button>
                    <button className="btn-ghost" onClick={() => resolve(report.id, "dismiss")} disabled={busy !== null}>
                      Dismiss
                    </button>
                  </div>
                </div>
              ) : (
                report.resolutionNote && (
                  <p className="mt-3 border-t border-stone-100 dark:border-stone-800 pt-3 text-sm text-stone-500 dark:text-stone-400">
                    Moderator note: {report.resolutionNote}
                  </p>
                )
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
