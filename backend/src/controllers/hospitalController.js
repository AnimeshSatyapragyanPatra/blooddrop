import { findNearbyHospitals } from "../lib/hospitals.js";
import { isLatLng } from "../lib/geo.js";

/**
 * GET /api/hospitals/nearby?lat=&lng=&radiusKm=
 *
 * Serves both sides of a request: a requester picking where the patient is,
 * and a donor working out where they would actually be going.
 */
export async function nearbyHospitals(req, res) {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);

  if (!isLatLng(lat, lng)) {
    return res.status(400).json({ error: "Provide a valid lat and lng" });
  }

  const radiusKm = req.query.radiusKm === undefined ? 10 : Number(req.query.radiusKm);
  if (!Number.isFinite(radiusKm) || radiusKm <= 0 || radiusKm > 50) {
    return res.status(400).json({ error: "radiusKm must be between 1 and 50" });
  }

  const result = await findNearbyHospitals({ lat, lng, radiusKm });
  res.json(result);
}
