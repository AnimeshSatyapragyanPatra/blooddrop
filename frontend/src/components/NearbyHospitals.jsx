import { useEffect, useState } from "react";
import { api, qs } from "../services/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { distance } from "../lib/format.js";
import { Spinner } from "./ui.jsx";

const KIND_LABEL = {
  hospital: "Hospital",
  blood_bank: "Blood bank",
  clinic: "Clinic",
};

/**
 * Hospitals, clinics and blood banks around a point, nearest first.
 *
 * Both sides of a request need this and for different reasons: a requester is
 * naming where the patient is, and a donor is working out where they would
 * actually have to travel to. Pass `onSelect` to make the list a picker;
 * without it the list is read-only.
 */
export default function NearbyHospitals({
  location,
  radiusKm = 10,
  onSelect,
  selectedName = null,
  title = "Hospitals and blood banks nearby",
  limit = 6,
}) {
  const { token } = useAuth();
  const [state, setState] = useState({ status: "idle", hospitals: [], reason: null, attribution: null });
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!location) {
      setState({ status: "idle", hospitals: [], reason: null, attribution: null });
      return;
    }

    const controller = new AbortController();
    // The map service is rate-limited and the map pin moves on every click,
    // so settle before asking.
    const timer = setTimeout(async () => {
      setState((s) => ({ ...s, status: "loading" }));
      try {
        const data = await api(
          `/api/hospitals/nearby${qs({ lat: location.lat, lng: location.lng, radiusKm })}`,
          { token, signal: controller.signal }
        );
        setState({
          status: data.available ? "ready" : "unavailable",
          hospitals: data.hospitals || [],
          reason: data.reason || null,
          attribution: data.attribution || null,
        });
      } catch (err) {
        if (err.name === "AbortError") return;
        setState({ status: "unavailable", hospitals: [], reason: err.message, attribution: null });
      }
    }, 600);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [location?.lat, location?.lng, radiusKm, token]);

  if (!location) return null;

  const shown = expanded ? state.hospitals : state.hospitals.slice(0, limit);

  return (
    <div className="card">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-stone-800 dark:text-stone-100">{title}</h3>
        <span className="text-xs text-stone-400 dark:text-stone-500">within {radiusKm} km</span>
      </div>

      {state.status === "loading" && <Spinner label="Finding nearby hospitals" rows={3} />}

      {state.status === "unavailable" && (
        <p className="text-sm text-stone-500 dark:text-stone-400">
          Could not reach the map service right now
          {state.reason ? ` (${state.reason})` : ""}. You can still type the hospital name yourself.
        </p>
      )}

      {state.status === "ready" && state.hospitals.length === 0 && (
        <p className="text-sm text-stone-500 dark:text-stone-400">
          No hospitals found within {radiusKm} km of this point. Try widening the radius or moving the pin.
        </p>
      )}

      {state.status === "ready" && shown.length > 0 && (
        <>
          <ul className="divide-y divide-stone-200/70 dark:divide-stone-700/60">
            {shown.map((h) => {
              const selected = selectedName && selectedName === h.name;
              const Row = onSelect ? "button" : "div";
              return (
                <li key={h.id}>
                  <Row
                    {...(onSelect
                      ? { type: "button", onClick: () => onSelect(h), className: "w-full text-left" }
                      : {})}
                    className={`flex w-full items-start justify-between gap-3 py-2 text-left ${
                      onSelect ? "rounded-lg px-1 hover:bg-stone-100 dark:hover:bg-stone-800/60" : ""
                    } ${selected ? "bg-blood-50 dark:bg-blood-900/20" : ""}`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-stone-800 dark:text-stone-100">
                        {h.name}
                      </span>
                      <span className="block truncate text-xs text-stone-500 dark:text-stone-400">
                        {KIND_LABEL[h.kind] || "Facility"}
                        {h.address ? ` · ${h.address}` : ""}
                      </span>
                    </span>
                    <span className="shrink-0 whitespace-nowrap text-xs font-semibold text-blood-700 dark:text-blood-300">
                      {distance(h.distanceKm)}
                    </span>
                  </Row>
                </li>
              );
            })}
          </ul>

          {state.hospitals.length > limit && (
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              className="mt-2 text-xs font-semibold text-blood-700 dark:text-blood-300 hover:underline"
            >
              {expanded ? "Show fewer" : `Show all ${state.hospitals.length}`}
            </button>
          )}

          {onSelect && (
            <p className="hint mt-2">Pick one to fill in the hospital name and move the pin to it.</p>
          )}
          {state.attribution && (
            <p className="mt-2 text-[11px] text-stone-400 dark:text-stone-500">{state.attribution}</p>
          )}
        </>
      )}
    </div>
  );
}
