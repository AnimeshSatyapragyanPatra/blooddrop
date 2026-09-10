import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { api, qs } from "../services/api.js";
import LocationField from "../components/LocationField.jsx";
import BloodGroupPicker from "../components/BloodGroupPicker.jsx";
import { distance } from "../lib/format.js";
import {
  BloodTag, EligibilityPill, EmptyState, ErrorBanner, Notice, PageHeader, ReliabilityMeter,
} from "../components/ui.jsx";

/**
 * Search exists to answer "is it even worth posting here?" — it never exposes a
 * way to contact anyone. Reaching donors happens through an alert dispatch.
 */
export default function FindDonors() {
  const { token } = useAuth();
  const [groups, setGroups] = useState(["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"]);
  const [bloodGroup, setBloodGroup] = useState("O-");
  const [radiusKm, setRadiusKm] = useState(25);
  const [includeIneligible, setIncludeIneligible] = useState(false);
  const [location, setLocation] = useState({ lat: 23.5204, lng: 87.3119 });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api("/api/config").then((c) => setGroups(c.bloodGroups)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!location) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await api(
          `/api/donors/search${qs({
            bloodGroup,
            lat: location.lat,
            lng: location.lng,
            radiusKm,
            includeIneligible: includeIneligible ? 1 : "",
          })}`,
          { token, signal: controller.signal }
        );
        setResult(data);
        setError(null);
      } catch (err) {
        if (err.name !== "AbortError") setError(err);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [bloodGroup, radiusKm, includeIneligible, location?.lat, location?.lng, token]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Find donors" subtitle="Who is reachable for a given blood group and area." />
      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <aside className="card space-y-4 p-5">
          <BloodGroupPicker
            value={bloodGroup}
            onChange={setBloodGroup}
            groups={groups}
            label="Patient's blood group"
            hint={`Results include every group that can safely give to ${bloodGroup}.`}
          />

          <div>
            <label className="label" htmlFor="radius">Radius: {radiusKm} km</label>
            <input
              id="radius"
              type="range"
              min={5}
              max={100}
              step={5}
              value={radiusKm}
              onChange={(e) => setRadiusKm(Number(e.target.value))}
              className="w-full accent-blood-600"
            />
          </div>

          <label className="flex items-start gap-2 text-sm text-stone-700 dark:text-stone-200">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={includeIneligible}
              onChange={(e) => setIncludeIneligible(e.target.checked)}
            />
            <span>
              Show donors inside the 90-day gap
              <span className="hint block">They cannot be alerted, but it shows the true depth of the pool.</span>
            </span>
          </label>

          <LocationField value={location} onChange={setLocation} radiusKm={radiusKm} label="Search around" />
        </aside>

        <section>
          <div className="mb-4 flex items-baseline justify-between">
            <p className="text-sm text-stone-600 dark:text-stone-300">
              {loading ? "Searching…" : `${result?.count ?? 0} donor${result?.count === 1 ? "" : "s"} within ${radiusKm} km`}
            </p>
          </div>

          {!loading && result?.donors.length === 0 ? (
            <EmptyState title="No matching donors in this area">
              Widen the radius, or post the request anyway — you can alert more donors as the radius grows.
            </EmptyState>
          ) : (
            <ul className="space-y-3">
              {(result?.donors || []).map((donor) => (
                <li key={donor.userId} className="card flex flex-wrap items-center gap-4 p-4">
                  <BloodTag group={donor.bloodGroup} />
                  <div className="min-w-40 flex-1">
                    <p className="text-sm font-semibold text-stone-900 dark:text-stone-50">{donor.displayName}</p>
                    <p className="text-sm text-stone-500 dark:text-stone-400">
                      {donor.areaLabel || "Nearby"} · {distance(donor.distanceKm)}
                    </p>
                    <p className="hint">Contact hidden: {donor.maskedPhone}</p>
                  </div>
                  <div className="flex flex-col items-start gap-2">
                    <EligibilityPill eligibility={{ eligible: donor.eligible, daysRemaining: donor.daysUntilEligible }} />
                    {donor.paused && <span className="chip bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-200">Alerts paused</span>}
                  </div>
                  <div className="w-40">
                    <ReliabilityMeter reliability={donor.reliability} compact />
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-6">
            <Notice tone="info">
              Names are shortened and numbers masked on purpose — a searchable list of donor phone numbers is exactly
              what this app exists to avoid. Donors are reached by posting a request, which alerts them directly.
            </Notice>
          </div>
        </section>
      </div>
    </div>
  );
}
