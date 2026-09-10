import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../services/api.js";
import { usePoll } from "../lib/usePoll.js";
import MapPicker from "../components/MapPicker.jsx";
import RequestCard from "../components/RequestCard.jsx";
import ReportDialog from "../components/ReportDialog.jsx";
import { CHANNEL_LABEL, distance, formatDateTime, timeAgo, timeUntil } from "../lib/format.js";
import {
  BloodTag, EmptyState, ErrorBanner, Notice, PageHeader, ReliabilityMeter, ResponseChip, Spinner,
  StatTile, UrgencyChip, VerifiedBadge,
} from "../components/ui.jsx";

export default function RequestDetail() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);
  const [contacts, setContacts] = useState({});
  const [relayTo, setRelayTo] = useState(null);
  const [relayText, setRelayText] = useState("");
  const [reporting, setReporting] = useState(false);
  const [widen, setWiden] = useState(null);

  const load = useCallback(async () => {
    try {
      const next = await api(`/api/requests/${id}`, { token });
      setData(next);
      setWiden((current) => current ?? next.request.radiusKm);
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  useEffect(() => {
    load();
  }, [load]);

  // The response board is the one screen worth watching closely, so it polls
  // fastest — still only while the requester is actually looking at it.
  usePoll(load, 15000);

  if (loading) return <Spinner />;
  if (!data) return <EmptyState title="Request not found">It may have been closed or removed.</EmptyState>;

  const { request, board } = data;
  const canModerate = user.role === "admin";

  async function dispatchMore() {
    setBusy("dispatch");
    setError(null);
    try {
      const result = await api(`/api/requests/${id}/dispatch`, {
        method: "POST",
        token,
        body: { radiusKm: widen },
      });
      await load();
      if (result.dispatch.alerted === 0) {
        setError(new Error("No new donors to alert at this radius — try widening it further."));
      }
    } catch (err) {
      setError(err);
    } finally {
      setBusy(null);
    }
  }

  async function close(status) {
    setBusy(status);
    try {
      await api(`/api/requests/${id}/close`, { method: "POST", token, body: { status } });
      await load();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(null);
    }
  }

  async function revealContact(donorUserId) {
    setBusy(donorUserId);
    try {
      const result = await api(`/api/requests/${id}/contact?donorUserId=${donorUserId}`, { token });
      setContacts((c) => ({ ...c, [donorUserId]: result.contact }));
    } catch (err) {
      setError(err);
    } finally {
      setBusy(null);
    }
  }

  async function sendRelay(event) {
    event.preventDefault();
    setBusy("relay");
    try {
      await api(`/api/requests/${id}/relay`, {
        method: "POST",
        token,
        body: { donorUserId: relayTo, message: relayText },
      });
      setRelayTo(null);
      setRelayText("");
    } catch (err) {
      setError(err);
    } finally {
      setBusy(null);
    }
  }

  async function recordOutcome(responseId, outcome) {
    setBusy(responseId);
    try {
      await api(`/api/responses/${responseId}/outcome`, { method: "POST", token, body: { outcome } });
      await load();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(null);
    }
  }

  // A donor looking at someone else's request gets the same card as the feed.
  if (!board) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Request" actions={<button className="btn-ghost" onClick={() => navigate(-1)}>Back</button>} />
        <ErrorBanner error={error} onDismiss={() => setError(null)} />
        <RequestCard request={request} onResponded={load} />
        {request.lat != null && (
          <div className="mt-4">
            <MapPicker value={{ lat: request.lat, lng: request.lng }} height={260} zoom={13} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Response tracking"
        subtitle="Who was alerted, who answered, and what happened."
        actions={
          request.status === "open" && (
            <>
              <button className="btn-success" onClick={() => close("fulfilled")} disabled={busy !== null}>
                Mark fulfilled
              </button>
              <button className="btn-secondary" onClick={() => close("closed")} disabled={busy !== null}>
                Close request
              </button>
            </>
          )
        }
      />

      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      <section className="card mb-6 p-5">
        <div className="flex flex-wrap items-start gap-4">
          <BloodTag group={request.bloodGroup} size="lg" />
          <div className="min-w-56 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <UrgencyChip urgency={request.urgency} />
              <VerifiedBadge verified={request.verified} organization={request.requester?.organization} />
              <span className="chip bg-stone-100 text-stone-600">{request.status}</span>
            </div>
            <h2 className="mt-2 text-lg font-semibold text-stone-900">
              {request.unitsNeeded} unit{request.unitsNeeded === 1 ? "" : "s"} of {request.bloodGroup} ·{" "}
              {request.hospitalName}
            </h2>
            <p className="mt-0.5 text-sm text-stone-500">
              {request.areaLabel} · posted {timeAgo(request.createdAt)}
              {request.neededBy && <> · needed {timeUntil(request.neededBy)} ({formatDateTime(request.neededBy)})</>}
            </p>
            {request.patientName && <p className="mt-1 text-sm text-stone-600">Patient: {request.patientName}</p>}
            {request.notes && <p className="mt-2 text-sm text-stone-600">{request.notes}</p>}
          </div>
          {canModerate && (
            <button className="btn-secondary" onClick={() => setReporting(true)}>
              Flag
            </button>
          )}
        </div>
      </section>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Alerted" value={board.summary.alerted} />
        <StatTile label="Available" value={board.summary.available} tone="good" />
        <StatTile label="Can't make it" value={board.summary.unavailable} />
        <StatTile label="Awaiting reply" value={board.summary.awaiting} tone="warn" />
      </div>

      {request.status === "open" && (
        <section className="card mb-6 flex flex-wrap items-end gap-4 p-5">
          <div className="flex-1">
            <label className="label" htmlFor="widen">
              Alert more donors — radius {widen} km
            </label>
            <input
              id="widen"
              type="range"
              min={5}
              max={100}
              step={5}
              value={widen}
              onChange={(e) => setWiden(Number(e.target.value))}
              className="w-full accent-blood-600"
            />
            <p className="hint">
              Donors already alerted are never alerted twice. Widening reaches only the new ones.
            </p>
          </div>
          <button className="btn-primary" onClick={dispatchMore} disabled={busy !== null}>
            {busy === "dispatch" ? "Alerting…" : "Send another round"}
          </button>
        </section>
      )}

      {request.lat != null && (
        <div className="mb-6">
          <MapPicker
            value={{ lat: request.lat, lng: request.lng }}
            radiusKm={request.radiusKm}
            height={260}
            zoom={11}
          />
        </div>
      )}

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-500">Donors alerted</h2>

      {board.rows.length === 0 ? (
        <EmptyState title="No donors alerted yet">
          Nobody eligible was in range when this was posted. Widen the radius above to reach further.
        </EmptyState>
      ) : (
        <div className="space-y-3">
          {board.rows.map((row) => {
            const contact = contacts[row.donorUserId];
            return (
              <article key={row.donorUserId} className="card p-4">
                <div className="flex flex-wrap items-start gap-4">
                  <BloodTag group={row.bloodGroup} />
                  <div className="min-w-48 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-stone-900">{row.displayName}</p>
                      <ResponseChip status={row.status} />
                      {row.outcome === "donated" && <span className="chip bg-emerald-100 text-emerald-800">Donated</span>}
                      {row.outcome === "no_show" && <span className="chip bg-blood-100 text-blood-800">No-show</span>}
                    </div>
                    <p className="mt-0.5 text-sm text-stone-500">
                      {row.areaLabel || "Nearby"} · {distance(row.distanceKm)} · alerted by{" "}
                      {CHANNEL_LABEL[row.channel] || row.channel} {timeAgo(row.alertedAt)}
                    </p>
                    {row.note && <p className="mt-1 text-sm text-stone-600">“{row.note}”</p>}
                    {!row.contactUnlocked && (
                      <p className="mt-1 text-xs text-stone-400">
                        Contact masked ({row.phone}) — unlocks if they accept.
                      </p>
                    )}
                  </div>

                  <div className="w-40">
                    <ReliabilityMeter reliability={row.reliability} compact />
                  </div>
                </div>

                {contact && (
                  <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm">
                    <p className="font-semibold text-emerald-900">{contact.name}</p>
                    <p className="text-emerald-800">
                      <a href={`tel:${contact.phone}`} className="font-semibold underline">{contact.phone}</a>
                      {contact.email && <> · {contact.email}</>}
                    </p>
                    <p className="mt-1 text-xs text-emerald-700">They have been notified that you viewed this.</p>
                  </div>
                )}

                {row.contactUnlocked && (
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-stone-100 pt-3">
                    {!contact && (
                      <button
                        className="btn-secondary"
                        onClick={() => revealContact(row.donorUserId)}
                        disabled={busy !== null}
                      >
                        {busy === row.donorUserId ? "Unlocking…" : "Reveal phone number"}
                      </button>
                    )}
                    <button className="btn-secondary" onClick={() => setRelayTo(row.donorUserId)} disabled={busy !== null}>
                      Message without sharing numbers
                    </button>
                    {!row.outcome && (
                      <>
                        <button
                          className="btn-success"
                          onClick={() => recordOutcome(row.responseId, "donated")}
                          disabled={busy !== null}
                        >
                          Confirm donation
                        </button>
                        <button
                          className="btn-ghost"
                          onClick={() => recordOutcome(row.responseId, "no_show")}
                          disabled={busy !== null}
                        >
                          Did not turn up
                        </button>
                      </>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {board.summary.available > 0 && (
        <div className="mt-6">
          <Notice tone="good">
            Confirming a donation resets that donor's 90-day eligibility clock automatically and adds to their
            reliability score — it is what keeps the matching honest for the next request.
          </Notice>
        </div>
      )}

      {relayTo && (
        <div className="fixed inset-0 z-[1000] grid place-items-center bg-stone-900/40 px-4" role="dialog" aria-modal="true">
          <form onSubmit={sendRelay} className="card w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-stone-900">Send a relayed message</h2>
            <p className="mt-1 text-sm text-stone-500">
              Delivered to the donor's inbox. Neither side's phone number is shared.
            </p>
            <textarea
              className="input mt-4 min-h-28"
              value={relayText}
              onChange={(e) => setRelayText(e.target.value)}
              maxLength={500}
              placeholder="e.g. Come to Ward 4 reception and ask for Dr. Roy."
              required
            />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setRelayTo(null)}>
                Cancel
              </button>
              <button className="btn-primary" disabled={busy !== null}>
                {busy === "relay" ? "Sending…" : "Send message"}
              </button>
            </div>
          </form>
        </div>
      )}

      {reporting && <ReportDialog targetType="request" targetId={request.id} onClose={() => setReporting(false)} />}
    </div>
  );
}
