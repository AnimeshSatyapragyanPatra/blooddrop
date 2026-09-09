export const URGENCY = {
  critical: { label: "Critical", chip: "bg-blood-100 text-blood-800", dot: "bg-blood-600" },
  urgent: { label: "Urgent", chip: "bg-amber-100 text-amber-800", dot: "bg-amber-500" },
  routine: { label: "Routine", chip: "bg-sky-100 text-sky-800", dot: "bg-sky-500" },
};

export const RESPONSE_LABEL = {
  available: { label: "Available", chip: "bg-emerald-100 text-emerald-800" },
  unavailable: { label: "Can't make it", chip: "bg-stone-100 text-stone-600" },
  no_reply: { label: "Awaiting reply", chip: "bg-amber-50 text-amber-700" },
};

export const CHANNEL_LABEL = { inapp: "In-app", email: "Email", sms: "SMS", push: "Push" };

export function distance(km) {
  if (km == null) return "—";
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

export function timeAgo(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} d ago`;
  return new Date(iso).toLocaleDateString();
}

export function timeUntil(iso) {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return "overdue";
  const hours = Math.round(diff / 3600000);
  if (hours < 24) return `in ${hours} h`;
  return `in ${Math.round(hours / 24)} d`;
}

export function formatDateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const REASON_LABEL = {
  fake: "Fake or fraudulent request",
  suspicious: "Suspicious details",
  spam: "Spam or repeated posting",
  no_show: "Donor did not turn up",
  harassment: "Harassment or abuse",
  other: "Something else",
};
