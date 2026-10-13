import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../services/api.js";
import { timeAgo } from "../lib/format.js";
import { BloodTag, EmptyState, ErrorBanner, Notice, PageHeader, Spinner } from "../components/ui.jsx";

const TABS = [
  ["pending", "To review"],
  ["verified", "Verified"],
  ["rejected", "Rejected"],
];

const API_URL = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? "http://localhost:5065" : "");

/**
 * Checking a donor's proof of blood group. This is the one queue where getting
 * it wrong sends the wrong blood towards a patient, so the reviewer is shown
 * the claim and the profile side by side and warned when they disagree.
 */
export default function AdminDocuments() {
  const { token } = useAuth();
  const [status, setStatus] = useState("pending");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);
  const [notes, setNotes] = useState({});
  const [previews, setPreviews] = useState({});

  const load = useCallback(async () => {
    try {
      const data = await api(`/api/admin/documents?status=${status}`, { token });
      setRows(data.documents);
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

  // The file is behind an authenticated endpoint, so it cannot simply be an
  // <img src>. Fetch it with the token and hand the tag an object URL.
  async function openFile(id) {
    if (previews[id]) return;
    try {
      const res = await fetch(`${API_URL}/api/admin/documents/${id}/file`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Could not load the file");
      const blob = await res.blob();
      setPreviews((p) => ({ ...p, [id]: { url: URL.createObjectURL(blob), type: blob.type } }));
    } catch (err) {
      setError(err);
    }
  }

  useEffect(() => () => {
    Object.values(previews).forEach((p) => URL.revokeObjectURL(p.url));
  }, [previews]);

  async function review(id, approve) {
    const note = notes[id] || "";
    if (!approve && !note.trim()) {
      setError(new Error("Give a reason when rejecting, so the donor can fix it."));
      return;
    }
    setBusy(id);
    setError(null);
    try {
      await api(`/api/admin/documents/${id}/review`, { method: "POST", token, body: { approve, note } });
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
        title="Blood group proofs"
        subtitle="Documents donors submitted to back the group on their profile."
        actions={
          <div className="flex gap-1 rounded-xl bg-stone-200/60 p-1 dark:bg-stone-800/60">
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
        <Notice tone="warn">
          Approving sets the donor's blood group to what the document claims. Reject anything unreadable or
          inconsistent — a wrong group here sends the wrong blood towards a patient. The file is deleted once you
          decide; only your decision is kept.
        </Notice>
      </div>

      {loading ? (
        <Spinner rows={2} />
      ) : rows.length === 0 ? (
        <EmptyState title={`Nothing ${status === "pending" ? "to review" : status}`}>
          Documents submitted by donors appear here.
        </EmptyState>
      ) : (
        <div className="space-y-4">
          {rows.map((doc) => {
            const preview = previews[doc.id];
            return (
              <article key={doc.id} className="card p-5">
                <div className="flex flex-wrap items-start gap-4">
                  <BloodTag group={doc.claimedBloodGroup} size="lg" />
                  <div className="min-w-56 flex-1">
                    <p className="text-base font-semibold text-stone-900 dark:text-stone-50">
                      {doc.applicant?.name || "Donor"}
                    </p>
                    <p className="text-sm text-stone-500 dark:text-stone-400">
                      {doc.docTypeLabel} · claims {doc.claimedBloodGroup} · {timeAgo(doc.createdAt)}
                    </p>
                    {doc.mismatch && (
                      <p className="mt-2 rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                        Their profile says {doc.profileBloodGroup}. Approving changes it to {doc.claimedBloodGroup}.
                      </p>
                    )}
                    {doc.reviewNote && (
                      <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">Note: {doc.reviewNote}</p>
                    )}
                  </div>
                </div>

                {doc.status === "pending" && (
                  <div className="mt-4 border-t border-stone-100 pt-4 dark:border-stone-800">
                    {!preview ? (
                      <button className="btn-secondary" onClick={() => openFile(doc.id)}>
                        View the document
                      </button>
                    ) : preview.type === "application/pdf" ? (
                      <a href={preview.url} target="_blank" rel="noreferrer" className="btn-secondary">
                        Open PDF in a new tab
                      </a>
                    ) : (
                      <img
                        src={preview.url}
                        alt="Submitted proof of blood group"
                        className="max-h-96 w-auto rounded-xl border border-stone-200 dark:border-stone-800"
                      />
                    )}

                    <label className="label mt-4" htmlFor={`note-${doc.id}`}>
                      Note <span className="font-normal text-stone-400">(required to reject)</span>
                    </label>
                    <input
                      id={`note-${doc.id}`}
                      className="input"
                      value={notes[doc.id] || ""}
                      onChange={(e) => setNotes((n) => ({ ...n, [doc.id]: e.target.value }))}
                      placeholder="e.g. the group is not legible on the scan"
                    />

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button className="btn-success" onClick={() => review(doc.id, true)} disabled={busy !== null}>
                        {busy === doc.id ? "Saving…" : `Verify as ${doc.claimedBloodGroup}`}
                      </button>
                      <button className="btn-secondary" onClick={() => review(doc.id, false)} disabled={busy !== null}>
                        Reject
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
