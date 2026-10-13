import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../services/api.js";
import { timeAgo } from "../lib/format.js";
import BloodGroupPicker from "./BloodGroupPicker.jsx";
import { ErrorBanner, Notice } from "./ui.jsx";

const STATUS = {
  pending: { label: "Awaiting review", chip: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300" },
  verified: { label: "Verified", chip: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300" },
  rejected: { label: "Not accepted", chip: "bg-blood-100 text-blood-800 dark:bg-blood-500/15 dark:text-blood-300" },
};

/** Read a File into a data URL the API can accept. */
function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("That file could not be read."));
    reader.readAsDataURL(file);
  });
}

/**
 * Proof of blood group. The group a donor types is what the whole matcher
 * trusts, so this lets them back it with a document a moderator checks.
 */
export default function BloodGroupProof() {
  const { token, donor, refresh } = useAuth();
  const fileInput = useRef(null);

  const [config, setConfig] = useState({ docTypes: [], maxBytes: 4 * 1024 * 1024, allowedMime: [] });
  const [state, setState] = useState({ documents: [], verified: false });
  const [docType, setDocType] = useState("donor_card");
  const [claimed, setClaimed] = useState(donor?.bloodGroup || "");
  const [file, setFile] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api("/api/me/documents", { token });
      setState(data);
      if (!claimed) setClaimed(data.bloodGroup || "");
    } catch (err) {
      setError(err);
    }
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    api("/api/documents/config", { token }).then(setConfig).catch(() => {});
    load();
  }, [token, load]);

  async function submit(event) {
    event.preventDefault();
    if (!file) return setError(new Error("Choose a file to upload."));
    setBusy(true);
    setError(null);
    try {
      const dataUrl = await readAsDataUrl(file);
      await api("/api/me/documents", {
        method: "POST",
        token,
        body: { docType, claimedBloodGroup: claimed, file: dataUrl, mimeType: file.type },
      });
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
      await load();
      await refresh();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  const pending = state.documents.find((d) => d.status === "pending");
  const maxMb = Math.round(config.maxBytes / (1024 * 1024));

  return (
    <section className="card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-stone-900 dark:text-stone-50">Prove your blood group</h2>
          <p className="hint">
            Your group decides which emergencies reach you. Backing it with a document means a requester is not
            relying on what you typed.
          </p>
        </div>
        {state.verified ? (
          <span className={`chip ${STATUS.verified.chip}`}>Verified {state.bloodGroup}</span>
        ) : (
          <span className="chip bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300">Self-declared</span>
        )}
      </div>

      <div className="mt-4">
        <ErrorBanner error={error} onDismiss={() => setError(null)} />
      </div>

      {state.documents.length > 0 && (
        <ul className="mb-5 space-y-2">
          {state.documents.map((doc) => (
            <li
              key={doc.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-stone-200 px-4 py-3 dark:border-stone-800"
            >
              <span className="text-sm text-stone-700 dark:text-stone-200">
                {doc.docTypeLabel} · claims {doc.claimedBloodGroup}
                <span className="hint"> submitted {timeAgo(doc.createdAt)}</span>
                {doc.reviewNote && (
                  <span className="mt-1 block text-xs text-stone-500 dark:text-stone-400">“{doc.reviewNote}”</span>
                )}
              </span>
              <span className={`chip ${STATUS[doc.status].chip}`}>{STATUS[doc.status].label}</span>
            </li>
          ))}
        </ul>
      )}

      {state.verified ? (
        <Notice tone="good">
          Your {state.bloodGroup} group was checked against a document. Nothing more to do.
        </Notice>
      ) : pending ? (
        <Notice tone="info">
          Your document is with a moderator. You will get an inbox message when it has been looked at.
        </Notice>
      ) : (
        <form onSubmit={submit} className="space-y-5">
          <div>
            <label className="label" htmlFor="docType">What are you uploading?</label>
            <select id="docType" className="input" value={docType} onChange={(e) => setDocType(e.target.value)}>
              {config.docTypes.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <p className="hint">
              A donor card or lab report is ideal — it shows the group and little else. Please cover any ID or
              account numbers before uploading; we only need the blood group and your name.
            </p>
          </div>

          <BloodGroupPicker
            value={claimed}
            onChange={setClaimed}
            name="claimedBloodGroup"
            label="Blood group shown on the document"
            required
          />

          <div>
            <label className="label" htmlFor="proofFile">The document</label>
            <input
              id="proofFile"
              ref={fileInput}
              type="file"
              accept={config.allowedMime.join(",")}
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="input file:mr-3 file:rounded-lg file:border-0 file:bg-stone-100 file:px-3 file:py-1.5 file:text-sm file:font-medium dark:file:bg-stone-800 dark:file:text-stone-200"
            />
            <p className="hint">JPG, PNG, WEBP or PDF, up to {maxMb} MB.</p>
          </div>

          <Notice tone="info">
            The file is shown to one moderator and then deleted — only their decision is kept. It is never shown
            to requesters or other donors.
          </Notice>

          <button className="btn-primary" disabled={busy || !file || !claimed}>
            {busy ? "Uploading…" : "Submit for review"}
          </button>
        </form>
      )}
    </section>
  );
}
