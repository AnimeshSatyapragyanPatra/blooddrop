// Nearby hospital and blood bank lookup.
//
// The data comes from OpenStreetMap through the Nominatim search API: global,
// free and keyless, which is what a student deployment can actually rely on.
// Nominatim's usage policy asks for three things in return, and all three are
// honoured here: an identifying User-Agent, no more than one request a second,
// and caching rather than re-fetching. Hospitals do not move, so a long cache
// costs nothing and keeps us well inside the policy.
//
// Results carry OpenStreetMap attribution, which the UI displays.

import { haversineKm, isLatLng, roundKm } from "./geo.js";

const ENDPOINT = process.env.NOMINATIM_URL || "https://nominatim.openstreetmap.org/search";
const USER_AGENT =
  process.env.NOMINATIM_USER_AGENT ||
  "BloodDrop/1.0 (blood donor alert network; github.com/AnimeshSatyapragyanPatra/blooddrop)";

const CACHE_TTL_MS = Number(process.env.HOSPITAL_CACHE_TTL_MS || 6 * 60 * 60 * 1000);
const MIN_REQUEST_GAP_MS = 1100;
const FETCH_TIMEOUT_MS = Number(process.env.NOMINATIM_TIMEOUT_MS || 8000);

// What we ask Nominatim for. Two passes, because a free-text search for
// "hospital" does not reliably surface standalone blood banks.
const QUERIES = [
  { term: "hospital", kind: "hospital" },
  { term: "blood bank", kind: "blood_bank" },
];

const cache = new Map();

// Nominatim allows one request per second. Every outbound call is threaded
// through this chain so concurrent callers queue instead of bursting.
let gate = Promise.resolve();
function rateLimited(task) {
  const run = gate.then(async () => {
    const result = await task();
    await new Promise((r) => setTimeout(r, MIN_REQUEST_GAP_MS));
    return result;
  });
  // Keep the chain alive even when one call rejects.
  gate = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

/** Degrees of longitude per km shrinks with latitude; degrees of latitude does not. */
function viewbox(lat, lng, radiusKm) {
  const dLat = radiusKm / 111;
  const dLng = radiusKm / (111 * Math.max(Math.cos((lat * Math.PI) / 180), 0.01));
  // Nominatim wants left,top,right,bottom.
  return [lng - dLng, lat + dLat, lng + dLng, lat - dLat].map((n) => n.toFixed(6)).join(",");
}

/** Nominatim's `type` is specific; collapse it to the three kinds the UI shows. */
function classify(row, fallback) {
  const type = String(row.type || "").toLowerCase();
  const name = String(row.name || row.display_name || "").toLowerCase();
  if (type.includes("blood") || name.includes("blood bank") || name.includes("blood centre")) {
    return "blood_bank";
  }
  if (type === "clinic" || type === "doctors" || name.includes("clinic")) return "clinic";
  if (type === "hospital" || name.includes("hospital")) return "hospital";
  return fallback;
}

/** "Durgapur Sub Divisional Hospital" twice, 30 m apart, is one hospital. */
function dedupe(rows) {
  const kept = [];
  for (const row of rows) {
    const key = row.name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const clash = kept.find(
      (k) =>
        k.name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() === key &&
        haversineKm(k.lat, k.lng, row.lat, row.lng) < 0.5
    );
    if (!clash) kept.push(row);
  }
  return kept;
}

async function search(term, lat, lng, radiusKm) {
  const url =
    `${ENDPOINT}?q=${encodeURIComponent(term)}&format=jsonv2&limit=40` +
    `&bounded=1&viewbox=${viewbox(lat, lng, radiusKm)}&addressdetails=1`;

  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Nominatim responded ${res.status}`);
  return res.json();
}

function shortAddress(row) {
  const a = row.address || {};
  const parts = [
    a.road || a.neighbourhood || a.suburb,
    a.city || a.town || a.village || a.county,
  ].filter(Boolean);
  return parts.join(", ") || (row.display_name || "").split(",").slice(1, 3).join(",").trim() || null;
}

/**
 * Hospitals, clinics and blood banks within `radiusKm` of a point, nearest first.
 *
 * Never throws: a lookup failure returns an empty list with `available: false`,
 * because an unreachable third-party map service must not be able to block
 * someone from posting a blood request.
 */
export async function findNearbyHospitals({ lat, lng, radiusKm = 10, limit = 12 }) {
  if (!isLatLng(Number(lat), Number(lng))) {
    return { available: false, hospitals: [], reason: "A valid location is required" };
  }

  const radius = Math.min(Math.max(Number(radiusKm) || 10, 1), 50);
  const key = `${Number(lat).toFixed(2)},${Number(lng).toFixed(2)},${radius}`;

  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return { ...hit.value, hospitals: hit.value.hospitals.slice(0, limit), cached: true };
  }

  const rows = [];
  let reached = false;
  let reason = null;

  for (const { term, kind } of QUERIES) {
    try {
      const results = await rateLimited(() => search(term, lat, lng, radius));
      reached = true;
      for (const row of results) {
        const hLat = Number(row.lat);
        const hLng = Number(row.lon);
        if (!isLatLng(hLat, hLng)) continue;

        const name = row.name || (row.display_name || "").split(",")[0];
        if (!name) continue;

        const distanceKm = haversineKm(Number(lat), Number(lng), hLat, hLng);
        if (distanceKm > radius) continue;

        rows.push({
          id: `${row.osm_type || "n"}${row.osm_id}`,
          name: name.trim(),
          kind: classify(row, kind),
          lat: hLat,
          lng: hLng,
          distanceKm: roundKm(distanceKm),
          address: shortAddress(row),
        });
      }
    } catch (err) {
      reason = err.name === "TimeoutError" ? "The map service did not respond in time" : err.message;
      console.warn(`[blooddrop] hospital lookup "${term}" failed: ${reason}`);
    }
  }

  if (!reached) {
    // Do not cache a failure — the next caller should get a fresh attempt.
    return {
      available: false,
      hospitals: [],
      reason: reason || "The map service is unavailable",
    };
  }

  const hospitals = dedupe(rows.sort((a, b) => a.distanceKm - b.distanceKm));
  const value = {
    available: true,
    hospitals,
    radiusKm: radius,
    attribution: "Data © OpenStreetMap contributors (ODbL)",
  };

  cache.set(key, { at: Date.now(), value });
  return { ...value, hospitals: hospitals.slice(0, limit) };
}
