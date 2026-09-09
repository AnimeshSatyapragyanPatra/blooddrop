import { useState } from "react";
import { api } from "../services/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { REASON_LABEL } from "../lib/format.js";
import { ErrorBanner } from "./ui.jsx";

/**
 * Flagging is deliberately one click away from every request. A network where
 * reporting a fake takes effort is a network that fills up with fakes.
 */
export default function ReportDialog({ targetType, targetId, onClose, onDone }) {
  const { token } = useAuth();
  const [reason, setReason] = useState("suspicious");
  const [details, setDetails] = useState("");
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api("/api/reports", {
        method: "POST",
        token,
        body: { targetType, targetId, reason, details },
      });
      onDone?.();
      onClose();
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[1000] grid place-items-center bg-stone-900/40 px-4" role="dialog" aria-modal="true">
      <form onSubmit={submit} className="card w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-stone-900">Report this {targetType}</h2>
        <p className="mt-1 text-sm text-stone-500">
          Reports go to a moderator, who can take the {targetType} down and notify everyone who was alerted.
        </p>

        <div className="mt-4">
          <ErrorBanner error={error} />
          <label className="label" htmlFor="report-reason">
            Reason
          </label>
          <select id="report-reason" className="input" value={reason} onChange={(e) => setReason(e.target.value)}>
            {Object.entries(REASON_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

          <label className="label mt-4" htmlFor="report-details">
            What did you notice? <span className="font-normal text-stone-400">(optional)</span>
          </label>
          <textarea
            id="report-details"
            className="input min-h-24"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="e.g. the same text was posted from three different numbers"
          />
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Sending…" : "Submit report"}
          </button>
        </div>
      </form>
    </div>
  );
}
