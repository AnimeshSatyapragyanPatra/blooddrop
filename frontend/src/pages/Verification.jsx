import { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../services/api.js";
import { ErrorBanner, Notice, PageHeader, VerifiedBadge } from "../components/ui.jsx";

export default function Verification() {
  const { token, user, verification, refresh } = useAuth();
  const [form, setForm] = useState({ organization: user.organization || "", orgType: "hospital", proofRef: "" });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const set = (key) => (event) => setForm((f) => ({ ...f, [key]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/me/verification", { method: "POST", token, body: form });
      await refresh();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Get verified"
        subtitle="A moderator-checked badge on your requests, so donors know they are real."
      />

      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      <div className="card mb-6 flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <p className="text-sm font-semibold text-stone-800">Current status</p>
          <p className="hint">{user.organization || "No organisation on file"}</p>
        </div>
        <VerifiedBadge verified={user.verified} organization={user.organization} />
      </div>

      {user.verified ? (
        <Notice tone="good">
          {user.organization} is verified. Every request you post from now on carries the badge.
        </Notice>
      ) : verification?.status === "pending" ? (
        <Notice tone="info">
          Your request for <strong>{verification.organization}</strong> is in the moderation queue. You will get an
          inbox message when it is reviewed.
        </Notice>
      ) : (
        <form onSubmit={submit} className="card space-y-5 p-6">
          {verification?.status === "rejected" && (
            <Notice tone="warn">
              A previous request for {verification.organization} was not approved. Submit again with a registration
              number a moderator can check.
            </Notice>
          )}

          <div>
            <label className="label" htmlFor="organization">Organisation name</label>
            <input id="organization" className="input" value={form.organization} onChange={set("organization")} required />
          </div>

          <div>
            <label className="label" htmlFor="orgType">Type</label>
            <select id="orgType" className="input" value={form.orgType} onChange={set("orgType")}>
              <option value="hospital">Hospital</option>
              <option value="blood_bank">Blood bank</option>
              <option value="ngo">NGO / donor group</option>
            </select>
          </div>

          <div>
            <label className="label" htmlFor="proofRef">Registration or licence number</label>
            <input
              id="proofRef"
              className="input"
              value={form.proofRef}
              onChange={set("proofRef")}
              placeholder="e.g. WB/BB/2291"
              required
            />
            <p className="hint">A moderator checks this against the public register before approving.</p>
          </div>

          <button className="btn-primary" disabled={busy}>
            {busy ? "Submitting…" : "Submit for review"}
          </button>
        </form>
      )}
    </div>
  );
}
