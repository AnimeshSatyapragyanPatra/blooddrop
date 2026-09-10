import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../services/api.js";
import { usePoll } from "../lib/usePoll.js";
import RequestCard from "../components/RequestCard.jsx";
import MapPicker from "../components/MapPicker.jsx";
import {
  BloodTag, EligibilityPill, ReliabilityMeter, EmptyState, ErrorBanner, PageHeader, Spinner, StatTile,
} from "../components/ui.jsx";

export default function DonorHome() {
  const { token, donor, refresh } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pausing, setPausing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api("/api/requests/nearby?radiusKm=30", { token });
      setRequests(data.requests);
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  usePoll(load, 45000); // keeps the feed live, but only while the tab is open

  async function togglePause() {
    setPausing(true);
    try {
      await api("/api/me/donor/paused", { method: "PATCH", token, body: { paused: !donor.paused } });
      await refresh();
    } catch (err) {
      setError(err);
    } finally {
      setPausing(false);
    }
  }

  if (!donor) {
    return (
      <EmptyState
        title="You are not registered as a donor yet"
        action={<Link to="/profile" className="btn-primary">Set up my donor profile</Link>}
      >
        Add your blood group and location and you will start receiving alerts when someone nearby needs your help.
      </EmptyState>
    );
  }

  const waiting = requests.filter((r) => !r.myResponse);
  const answered = requests.filter((r) => r.myResponse);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Alerts for me"
        subtitle="Requests you can help with, closest and most urgent first."
        actions={
          <button className="btn-secondary" onClick={togglePause} disabled={pausing}>
            {donor.paused ? "Resume alerts" : "Pause alerts"}
          </button>
        }
      />

      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      <section className="card mb-6 overflow-hidden">
        <div className="flex flex-wrap items-center gap-5 p-5">
          <BloodTag group={donor.bloodGroup} size="lg" />
          <div className="min-w-48 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <EligibilityPill eligibility={donor.eligibility} />
              {donor.paused && <span className="chip bg-stone-200 text-stone-700">Alerts paused</span>}
            </div>
            <p className="mt-2 text-sm text-stone-600">
              {donor.eligibility.eligible
                ? "You are inside the eligible window — you will be alerted for matching requests nearby."
                : `Your next eligible date is ${donor.eligibility.eligibleOn}. We will not alert you until then.`}
            </p>
            <p className="hint">{donor.areaLabel || "Location set on map"}</p>
          </div>
          <div className="w-full sm:w-56">
            <ReliabilityMeter reliability={donor.reliability} />
          </div>
        </div>

        {donor.lat != null && (
          <MapPicker
            value={{ lat: donor.lat, lng: donor.lng }}
            radiusKm={30}
            height={180}
            zoom={10}
            points={requests
              .filter((r) => r.lat != null)
              .map((r) => ({
                id: r.id,
                lat: r.lat,
                lng: r.lng,
                label: r.bloodGroup,
                colour: r.urgency === "critical" ? "#b91c1c" : "#0f766e",
                title: `${r.bloodGroup} · ${r.hospitalName}`,
              }))}
          />
        )}
      </section>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <StatTile label="Waiting for you" value={waiting.length} tone={waiting.length ? "blood" : "default"} />
        <StatTile label="You answered" value={answered.length} />
        <StatTile
          label="Confirmed donations"
          value={donor.reliability.donationsConfirmed}
          tone="good"
          sub="Recorded by requesters"
        />
      </div>

      {loading ? (
        <Spinner />
      ) : waiting.length === 0 ? (
        <EmptyState title="Nothing needs you right now">
          When a compatible request is posted within 30 km, it appears here and in your inbox.
        </EmptyState>
      ) : (
        <div className="space-y-4">
          {waiting.map((request) => (
            <RequestCard key={request.id} request={request} onResponded={load} />
          ))}
        </div>
      )}

      {answered.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-500">Already answered</h2>
          <div className="space-y-4">
            {answered.map((request) => (
              <RequestCard key={request.id} request={request} onResponded={load} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
