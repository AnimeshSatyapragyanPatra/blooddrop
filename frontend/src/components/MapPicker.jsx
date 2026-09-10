import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Circle, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";

// Leaflet's default marker images break under bundlers, so every marker here is
// a div icon — no image assets, and it themes with the rest of the UI.
function pinIcon({ colour = "#dc2626", label = "", pulse = false }) {
  return L.divIcon({
    className: "",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    html: `
      <span style="position:relative;display:grid;place-items:center;width:28px;height:28px">
        ${pulse ? `<span style="position:absolute;inset:0;border-radius:9999px;background:${colour};opacity:.35;animation:pulseRing 2s cubic-bezier(.4,0,.6,1) infinite"></span>` : ""}
        <span style="position:relative;display:grid;place-items:center;width:22px;height:22px;border-radius:9999px;background:${colour};color:#fff;font:600 9px/1 DM Sans,sans-serif;box-shadow:0 1px 4px rgba(0,0,0,.4);border:2px solid #fff">${label}</span>
      </span>`,
  });
}

function ClickCapture({ onPick }) {
  useMapEvents({
    click(event) {
      if (onPick) onPick({ lat: event.latlng.lat, lng: event.latlng.lng });
    },
  });
  return null;
}

function Recentre({ centre, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (centre) map.setView([centre.lat, centre.lng], zoom ?? map.getZoom());
  }, [centre?.lat, centre?.lng, zoom]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

/**
 * One map component for every screen:
 *  - `onPick` makes it an interactive location picker
 *  - `radiusKm` draws the alert radius
 *  - `points` plots donors or requests around the centre
 */
export default function MapPicker({
  value,
  onPick,
  radiusKm,
  points = [],
  height = 320,
  zoom = 12,
  centre,
  className = "",
}) {
  const start = value || centre || { lat: 23.5204, lng: 87.3119 };
  const markers = useMemo(() => points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng)), [points]);

  return (
    <div className={`overflow-hidden rounded-xl border border-stone-200 dark:border-stone-800 ${className}`} style={{ height }}>
      <MapContainer center={[start.lat, start.lng]} zoom={zoom} scrollWheelZoom className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {onPick && <ClickCapture onPick={onPick} />}
        <Recentre centre={centre} zoom={zoom} />

        {value && (
          <>
            <Marker position={[value.lat, value.lng]} icon={pinIcon({ colour: "#b91c1c", pulse: true })} />
            {radiusKm > 0 && (
              <Circle
                center={[value.lat, value.lng]}
                radius={radiusKm * 1000}
                pathOptions={{ color: "#dc2626", weight: 1, fillColor: "#dc2626", fillOpacity: 0.06 }}
              />
            )}
          </>
        )}

        {markers.map((point) => (
          <Marker
            key={point.id}
            position={[point.lat, point.lng]}
            icon={pinIcon({ colour: point.colour || "#0f766e", label: point.label || "" })}
            title={point.title || ""}
          />
        ))}
      </MapContainer>
    </div>
  );
}
