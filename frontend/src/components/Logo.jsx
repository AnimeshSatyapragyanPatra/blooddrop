/**
 * The BloodDrop mark: a filled droplet with a soft internal gradient and a
 * highlight arc, so it reads as a liquid drop rather than a generic pin.
 * Gradient ids are suffixed per instance — two logos on one page would
 * otherwise share (and fight over) the same <defs> id.
 */
let seq = 0;

export default function Logo({ className = "h-6 w-6", withRing = false }) {
  const id = `drop-${(seq += 1)}`;

  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fca5a5" />
          <stop offset="45%" stopColor="#ef4444" />
          <stop offset="100%" stopColor="#991b1b" />
        </linearGradient>
      </defs>

      {withRing && (
        <circle cx="12" cy="13.5" r="9.5" fill="currentColor" opacity="0.14">
          <animate attributeName="r" values="8.5;10.5;8.5" dur="2.8s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.18;0.04;0.18" dur="2.8s" repeatCount="indefinite" />
        </circle>
      )}

      {/* The droplet: a sharp apex easing into a full round belly. */}
      <path
        d="M12 2.2c0 0 7 7.7 7 12.05A7 7 0 0 1 5 14.25C5 9.9 12 2.2 12 2.2z"
        fill={`url(#${id})`}
      />
      {/* Specular highlight — a crescent catching light on the lower left. */}
      <path
        d="M9.1 16.6a3.6 3.6 0 0 1-.7-3.9"
        fill="none"
        stroke="#fff"
        strokeOpacity="0.55"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
