import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../services/api.js";
import { timeAgo } from "../lib/format.js";
import { EmptyState, ErrorBanner, Notice, PageHeader, Spinner } from "../components/ui.jsx";

const ORG_LABEL = { hospital: "Hospital", blood_bank: "Blood bank", ngo: "NGO / donor group" };
const TABS = [
  ["pending", "Pending"],
  ["verified", "Approved"],
  ["rejected", "Rejected"],
];

export default function AdminVerifications() {
  const { token } = useAuth();
  const [status, setStatus] = useState("pending");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api(`/api/admin/verifications?status=${status}`, { token });
      setRows(data.verifications);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [token, status]);

  useEffect(() => {
    load();
  }, [load]);

  async function review(id, approve) {
    setBusy(id);
    try {
      await api(`/api/admin/verifications/${id}/review`, { method: "POST", token, body: { approve } });
      await load();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Verification queue"
        subtitle="Hospitals, blood banks and NGOs applying for the badge."
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
          Check the registration number against the public register before approving — the badge is the main signal
          donors use to tell a real emergency from a prank.
        </Notice>
      </div>

      {loading ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <EmptyState title={`Nothing ${status}`}>No applications in this state.</EmptyState>
      ) : (
        <div className="space-y-4">
          {rows.map((row) => (
            <article key={row.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <span className="chip bg-sky-100 dark:bg-sky-500/15 text-sky-800 dark:text-sky-300">{ORG_LABEL[row.orgType]}</span>
                  <p className="mt-2 text-base font-semibold text-stone-900 dark:text-stone-50">{row.organization}</p>
                  <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">
                    Registration: <span className="font-mono">{row.proofRef}</span>
                  </p>
                  {row.applicant && (
                    <p className="mt-1 text-xs text-stone-400 dark:text-stone-500">
                      {row.applicant.name} · {row.applicant.email} · {row.applicant.phone} · {timeAgo(row.createdAt)}
                    </p>
                  )}
                </div>

                {row.status === "pending" && (
                  <div className="flex gap-2">
                    <button className="btn-success" onClick={() => review(row.id, true)} disabled={busy !== null}>
                      Approve
                    </button>
                    <button className="btn-secondary" onClick={() => review(row.id, false)} disabled={busy !== null}>
                      Reject
                    </button>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
