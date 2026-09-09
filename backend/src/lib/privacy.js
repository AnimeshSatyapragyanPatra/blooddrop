// Phone-number masking. Donor and requester numbers never leave the server in
// full unless the two parties are actually connected on a request — see
// contactController.js for the unlock rule. Everything else gets a mask.

/** "+91 98765 43210" -> "+91 ••••• ••210" (keeps country hint + last 3 digits). */
export function maskPhone(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, "");
  if (digits.length < 4) return "••••";
  const tail = digits.slice(-3);
  const head = String(phone).trim().startsWith("+") ? `+${digits.slice(0, digits.length - 10 || 2)} ` : "";
  return `${head}••••• ••${tail}`;
}

/** "Priya Sharma" -> "Priya S." — enough to recognise, not enough to look up. */
export function maskName(name) {
  if (!name) return "Donor";
  const parts = String(name).trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

/** Coarsen a precise location to roughly a ~1km grid before showing it to others. */
export function fuzzLatLng(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { lat: null, lng: null };
  return { lat: Math.round(lat * 100) / 100, lng: Math.round(lng * 100) / 100 };
}

export function maskEmail(email) {
  if (!email) return null;
  const [user, domain] = String(email).split("@");
  if (!domain) return "•••";
  const visible = user.slice(0, 2);
  return `${visible}${"•".repeat(Math.max(3, user.length - 2))}@${domain}`;
}
