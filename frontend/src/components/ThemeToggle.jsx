import { useTheme } from "../context/ThemeContext.jsx";

const ICONS = {
  light: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  dark: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />,
  system: (
    <>
      <rect x="2" y="4" width="20" height="13" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </>
  ),
};

const LABEL = { light: "Light", dark: "Dark", system: "System" };

/** Cycles light -> dark -> follow system. */
export default function ThemeToggle({ className = "" }) {
  const { preference, cycle } = useTheme();

  return (
    <button
      type="button"
      onClick={cycle}
      title={`Theme: ${LABEL[preference]} — click to change`}
      aria-label={`Theme: ${LABEL[preference]}. Click to change.`}
      className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-stone-400 transition hover:bg-white/5 hover:text-white ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4 shrink-0"
        aria-hidden="true"
      >
        {ICONS[preference]}
      </svg>
      {LABEL[preference]}
    </button>
  );
}
