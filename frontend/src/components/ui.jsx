import { URGENCY, RESPONSE_LABEL } from "../lib/format.js";

export function BloodTag({ group, size = "md" }) {
  const sizes = { sm: "h-7 w-9 text-xs", md: "h-10 w-12 text-sm", lg: "h-14 w-16 text-lg" };
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-lg bg-blood-50 font-bold tracking-tight text-blood-700 ring-1 ring-inset ring-blood-200 ${sizes[size]}`}
    >
      {group}
    </span>
  );
}

export function VerifiedBadge({ verified, organization }) {
  if (!verified) {
    return (
      <span className="chip bg-stone-100 text-stone-600" title="This requester has not been verified by a moderator">
        Unverified
      </span>
    );
  }
  return (
    <span className="chip bg-sky-100 text-sky-800" title={organization ? `Verified: ${organization}` : "Verified requester"}>
      <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
        <path
          fillRule="evenodd"
          d="M10 1.5l2.1 1.6 2.6-.2.9 2.5 2.2 1.4-1 2.4 1 2.4-2.2 1.4-.9 2.5-2.6-.2L10 18.5l-2.1-1.6-2.6.2-.9-2.5-2.2-1.4 1-2.4-1-2.4 2.2-1.4.9-2.5 2.6.2L10 1.5zm3.7 6.3l-1.1-1.1-3.3 3.3-1.6-1.6-1.1 1.1 2.7 2.7 4.4-4.4z"
          clipRule="evenodd"
        />
      </svg>
      Verified
    </span>
  );
}

export function UrgencyChip({ urgency }) {
  const u = URGENCY[urgency] || URGENCY.routine;
  // Only "critical" animates. If everything pulsed, nothing would read as urgent.
  const critical = urgency === "critical";
  return (
    <span className={`chip ${u.chip}`}>
      <span className="relative grid h-1.5 w-1.5 place-items-center" aria-hidden="true">
        {critical && <span className={`absolute h-1.5 w-1.5 rounded-full ${u.dot} animate-ping opacity-75`} />}
        <span className={`relative h-1.5 w-1.5 rounded-full ${u.dot}`} />
      </span>
      {u.label}
    </span>
  );
}

export function ResponseChip({ status }) {
  const s = RESPONSE_LABEL[status] || RESPONSE_LABEL.no_reply;
  return <span className={`chip ${s.chip}`}>{s.label}</span>;
}

/**
 * Reliability is shown as a labelled bar, never as a bare number — a "62" with
 * no context reads like a grade, and new donors would look bad by default.
 */
export function ReliabilityMeter({ reliability, compact = false }) {
  if (!reliability) return <span className="text-xs text-stone-400">—</span>;

  const { score, tier, isNew, responseRate, donationsConfirmed } = reliability;
  const colour = { high: "bg-emerald-500", medium: "bg-amber-500", low: "bg-stone-400" }[tier];
  const label = isNew ? "New donor" : { high: "Very reliable", medium: "Fairly reliable", low: "Rarely responds" }[tier];

  return (
    <div className={compact ? "w-28" : "w-full max-w-xs"}>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-medium text-stone-700">{label}</span>
        {!isNew && <span className="tabular-nums text-stone-500">{score}</span>}
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-stone-200">
        <div className={`h-full rounded-full ${colour}`} style={{ width: `${Math.max(4, score)}%` }} />
      </div>
      {!compact && (
        <p className="hint">
          {isNew
            ? "No alert history yet"
            : `${responseRate ?? 0}% of alerts answered · ${donationsConfirmed} confirmed donation${
                donationsConfirmed === 1 ? "" : "s"
              }`}
        </p>
      )}
    </div>
  );
}

export function EligibilityPill({ eligibility }) {
  if (!eligibility) return null;
  if (eligibility.eligible) {
    return <span className="chip bg-emerald-100 text-emerald-800">Eligible to donate</span>;
  }
  return (
    <span className="chip bg-amber-100 text-amber-800">
      Eligible in {eligibility.daysRemaining} day{eligibility.daysRemaining === 1 ? "" : "s"}
    </span>
  );
}

export function StatTile({ label, value, sub, tone = "default" }) {
  const tones = {
    default: "text-stone-900",
    blood: "text-blood-700",
    good: "text-emerald-700",
    warn: "text-amber-700",
  };
  const wash = {
    default: "",
    blood: "bg-gradient-to-br from-blood-50/80 to-transparent",
    good: "bg-gradient-to-br from-emerald-50/80 to-transparent",
    warn: "bg-gradient-to-br from-amber-50/80 to-transparent",
  };
  return (
    <div className={`card p-4 transition hover:border-stone-300 ${wash[tone]}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-stone-500">{label}</p>
      <p className={`mt-1 text-3xl font-bold leading-none tabular-nums ${tones[tone]}`}>{value}</p>
      {sub && <p className="hint">{sub}</p>}
    </div>
  );
}

export function EmptyState({ title, children, action }) {
  return (
    <div className="card grid place-items-center px-6 py-14 text-center">
      <p className="text-base font-semibold text-stone-800">{title}</p>
      {children && <p className="mt-1 max-w-md text-sm text-stone-500">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorBanner({ error, onDismiss }) {
  if (!error) return null;
  return (
    <div role="alert" className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-blood-200 bg-blood-50 px-4 py-3 text-sm text-blood-800">
      <span>{typeof error === "string" ? error : error.message}</span>
      {onDismiss && (
        <button onClick={onDismiss} className="shrink-0 text-blood-600 hover:text-blood-800" aria-label="Dismiss">
          ✕
        </button>
      )}
    </div>
  );
}

export function Notice({ tone = "info", children }) {
  const tones = {
    info: "border-sky-200 bg-sky-50 text-sky-900",
    good: "border-emerald-200 bg-emerald-50 text-emerald-900",
    warn: "border-amber-200 bg-amber-50 text-amber-900",
  };
  return <div className={`rounded-xl border px-4 py-3 text-sm ${tones[tone]}`}>{children}</div>;
}

/**
 * Card-shaped placeholders while data loads. Holding the layout's shape stops
 * the page jumping when the real content lands.
 */
export function Spinner({ label = "Loading", rows = 3 }) {
  return (
    <div role="status" aria-label={label} className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="card flex items-center gap-4 p-5">
          <div className="skeleton h-12 w-14 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-3 w-24" />
            <div className="skeleton h-4 w-2/3" />
            <div className="skeleton h-3 w-1/3" />
          </div>
        </div>
      ))}
      <span className="sr-only">{label}…</span>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-stone-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-stone-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
