import { useState } from "react";
import MapPicker from "./MapPicker.jsx";

/**
 * Location input with three ways in: the browser's geolocation, a click on the
 * map, or typed coordinates. Approximate is fine — matching works on distance
 * bands, and a donor's exact address is never shown to anyone.
 */
export default function LocationField({ value, onChange, radiusKm, label = "Location", hint, points = [] }) {
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState(null);

  function useMyLocation() {
    if (!navigator.geolocation) {
      setError("This browser cannot share your location — click the map instead.");
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        onChange({ lat: position.coords.latitude, lng: position.coords.longitude });
        setLocating(false);
      },
      () => {
        setError("Location permission denied — click the map to set it manually.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <span className="label mb-0">{label}</span>
        <button type="button" onClick={useMyLocation} className="text-xs font-semibold text-blood-700 hover:underline">
          {locating ? "Locating…" : "Use my current location"}
        </button>
      </div>

      <MapPicker value={value} onPick={onChange} radiusKm={radiusKm} points={points} height={260} centre={value} />

      <p className="hint">
        {value
          ? `Selected: ${value.lat.toFixed(4)}, ${value.lng.toFixed(4)} — click the map to adjust.`
          : hint || "Click anywhere on the map to drop a pin."}
      </p>
      {error && <p className="mt-1 text-xs text-blood-700">{error}</p>}
    </div>
  );
}
