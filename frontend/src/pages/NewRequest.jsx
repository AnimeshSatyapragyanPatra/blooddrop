import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { api, qs } from "../services/api.js";
import LocationField from "../components/LocationField.jsx";
import BloodGroupPicker from "../components/BloodGroupPicker.jsx";
import { distance } from "../lib/format.js";
import { ErrorBanner, GroupVerification, Notice, PageHeader, ReliabilityMeter, VerifiedBadge } from "../components/ui.jsx";

const RADII = [5, 10, 15, 25, 50];

export default function NewRequest() {
  const { token, user } = useAuth();
  const navigate = useNavigate();

  const [groups, setGroups] = useState(["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"]);
  const [form, setForm] = useState({
    patientName: "",
    bloodGroup: "",
    unitsNeeded: 1,
    hospitalName: "",
    areaLabel: "",
    urgency: "critical",
    neededBy: "",
    notes: "",
  });
  const [location, setLocation] = useState(null);
  const [radiusKm, setRadiusKm] = useState(15);
  const [preview, setPreview] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api("/api/config").then((c) => setGroups(c.bloodGroups)).catch(() => {});
  }, []);

  const canPreview = Boolean(form.bloodGroup && location);

  // Live "who would this reach?" — a requester should know whether the radius
  // is worth widening *before* the alert goes out, not after silence.
  useEffect(() => {
    if (!canPreview) {
      setPreview(null);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setPreviewing(true);
      try {
        const data = await api(
          `/api/requests/preview-matches${qs({
            bloodGroup: form.bloodGroup,
            lat: location.lat,
            lng: location.lng,
            radiusKm,
          })}`,
          { token, signal: controller.signal }
        );
        setPreview(data);
      } catch (err) {
        if (err.name !== "AbortError") setPreview(null);
      } finally {
        setPreviewing(false);
      }
    }, 350);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [canPreview, form.bloodGroup, location?.lat, location?.lng, radiusKm, token]);

  const set = (key) => (event) => setForm((f) => ({ ...f, [key]: event.target.value }));

  const mapPoints = useMemo(
    () =>
      (preview?.donors || [])
        .filter((d) => d.approxLat != null)
        .map((d) => ({
          id: d.userId,
          lat: d.approxLat,
          lng: d.approxLng,
          label: d.bloodGroup,
          colour: "#0f766e",
          title: `${d.bloodGroup} · ${distance(d.distanceKm)}`,
        })),
    [preview]
  );

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const data = await api("/api/requests", {
        method: "POST",
        token,
        body: {
          ...form,
          unitsNeeded: Number(form.unitsNeeded),
          lat: location?.lat,
          lng: location?.lng,
          radiusKm,
          neededBy: form.neededBy || null,
          dispatch: true,
        },
      });
      navigate(`/requests/${data.request.id}`);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Post an emergency request"
        subtitle="Matching donors are alerted the moment you post."
      />

      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <VerifiedBadge verified={user.verified} organization={user.organization} />
        <span className="text-sm text-stone-500 dark:text-stone-400">
          {user.verified
            ? "Your requests carry the verified badge."
            : "Unverified requests are still delivered, but donors see them without a badge."}
        </span>
      </div>

      <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="card space-y-5 p-6">
          <BloodGroupPicker
            value={form.bloodGroup}
            onChange={(g) => setForm((f) => ({ ...f, bloodGroup: g }))}
            groups={groups}
            label="Blood group needed"
            required
            hint="We alert every compatible group, not just an exact match."
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="units">Units needed</label>
              <input
                id="units"
                className="input"
                type="number"
                min={1}
                max={20}
                value={form.unitsNeeded}
                onChange={set("unitsNeeded")}
                required
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="hospital">Hospital or blood bank</label>
              <input id="hospital" className="input" value={form.hospitalName} onChange={set("hospitalName")} required />
            </div>
            <div>
              <label className="label" htmlFor="patient">
                Patient reference <span className="font-normal text-stone-400 dark:text-stone-500">(optional)</span>
              </label>
              <input id="patient" className="input" value={form.patientName} onChange={set("patientName")} />
              <p className="hint">Only you and moderators see this — donors never do.</p>
            </div>
            <div>
              <label className="label" htmlFor="area">Area name</label>
              <input id="area" className="input" value={form.areaLabel} onChange={set("areaLabel")} />
            </div>
            <div>
              <label className="label" htmlFor="urgency">Urgency</label>
              <select id="urgency" className="input" value={form.urgency} onChange={set("urgency")}>
                <option value="critical">Critical — needed within hours</option>
                <option value="urgent">Urgent — needed within a day or two</option>
                <option value="routine">Routine — planned transfusion</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="neededBy">
                Needed by <span className="font-normal text-stone-400 dark:text-stone-500">(optional)</span>
              </label>
              <input id="neededBy" className="input" type="datetime-local" value={form.neededBy} onChange={set("neededBy")} />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="notes">Notes for donors</label>
              <textarea
                id="notes"
                className="input min-h-24"
                value={form.notes}
                onChange={set("notes")}
                placeholder="Ward, contact desk, timing — anything that helps a donor decide."
              />
            </div>
          </div>

          <LocationField
            value={location}
            onChange={setLocation}
            radiusKm={radiusKm}
            points={mapPoints}
            label="Hospital location"
            hint="Click the map to drop a pin on the hospital."
          />

          <div>
            <label className="label" htmlFor="radius">Alert radius: {radiusKm} km</label>
            <input
              id="radius"
              type="range"
              min={RADII[0]}
              max={RADII[RADII.length - 1]}
              step={1}
              value={radiusKm}
              onChange={(e) => setRadiusKm(Number(e.target.value))}
              className="w-full accent-blood-600"
            />
            <div className="flex justify-between text-xs text-stone-400 dark:text-stone-500">
              {RADII.map((km) => (
                <span key={km}>{km}</span>
              ))}
            </div>
          </div>

          <button className="btn-primary w-full" disabled={busy || !location || !form.bloodGroup}>
            {busy ? "Posting and alerting…" : "Post request and alert donors"}
          </button>
        </div>

        <aside className="space-y-4">
          <div className="card p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">Who this will reach</h2>
            {!canPreview ? (
              <p className="mt-3 text-sm text-stone-500 dark:text-stone-400">
                Choose a blood group and drop a pin to see the matching donors.
              </p>
            ) : previewing ? (
              <p className="mt-3 text-sm text-stone-500 dark:text-stone-400">Checking…</p>
            ) : preview ? (
              <>
                <p className="mt-2 text-3xl font-bold tabular-nums text-blood-700 dark:text-blood-300">{preview.willAlert}</p>
                <p className="text-sm text-stone-600 dark:text-stone-300">
                  eligible donors alerted now
                  {preview.count > preview.willAlert && ` (of ${preview.count} matched)`}
                </p>
                {preview.count === 0 && (
                  <div className="mt-3">
                    <Notice tone="warn">
                      No eligible donor in range. Widen the radius — the request is still worth posting, and you can
                      alert more donors later.
                    </Notice>
                  </div>
                )}
                <ul className="mt-4 space-y-3">
                  {preview.donors.slice(0, 5).map((d) => (
                    <li key={d.userId} className="flex items-start justify-between gap-3 border-t border-stone-100 dark:border-stone-800 pt-3">
                      <div>
                        <p className="text-sm font-semibold text-stone-800 dark:text-stone-100">{d.bloodGroup}</p>
                        <p className="text-xs text-stone-500 dark:text-stone-400">{d.areaLabel || "Nearby"} · {distance(d.distanceKm)}</p>
                        {d.verification?.verified && <div className="mt-1"><GroupVerification verification={d.verification} compact /></div>}
                      </div>
                      <ReliabilityMeter reliability={d.reliability} compact />
                    </li>
                  ))}
                </ul>
                <p className="hint mt-3">
                  Names and numbers stay hidden — donors are contacted through the alert, not by you.
                </p>
              </>
            ) : null}
          </div>
        </aside>
      </form>
    </div>
  );
}
