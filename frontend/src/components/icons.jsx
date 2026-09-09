// Small stroke icons, sized to sit beside 14px nav text. Inline so there is no
// icon-font download and no extra dependency.
const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  viewBox: "0 0 24 24",
  "aria-hidden": true,
};

const Svg = ({ children, className = "h-4 w-4" }) => (
  <svg {...base} className={className}>
    {children}
  </svg>
);

export const IconBell = (p) => (
  <Svg {...p}><path d="M18 8A6 6 0 1 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></Svg>
);
export const IconPin = (p) => (
  <Svg {...p}><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></Svg>
);
export const IconPlus = (p) => (
  <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>
);
export const IconList = (p) => (
  <Svg {...p}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></Svg>
);
export const IconUser = (p) => (
  <Svg {...p}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></Svg>
);
export const IconSearch = (p) => (
  <Svg {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" /></Svg>
);
export const IconBadge = (p) => (
  <Svg {...p}><path d="m12 2 2.4 1.8 3-.2 1 2.9 2.5 1.6-1.1 2.8 1.1 2.8-2.5 1.6-1 2.9-3-.2L12 20l-2.4-1.8-3 .2-1-2.9L3.1 13.9 4.2 11.1 3.1 8.3 5.6 6.7l1-2.9 3 .2Z" /><path d="m9 12 2 2 4-4" /></Svg>
);
export const IconChart = (p) => (
  <Svg {...p}><path d="M3 3v18h18" /><path d="M7 15l3.5-4 3 2.5L18 8" /></Svg>
);
export const IconFlag = (p) => (
  <Svg {...p}><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V4s-1 1-4 1-5-2-8-2-4 1-4 1Z" /><path d="M4 22v-7" /></Svg>
);
export const IconShield = (p) => (
  <Svg {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></Svg>
);
export const IconInbox = (p) => (
  <Svg {...p}><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.7 4H7.3a2 2 0 0 0-1.8 1.1Z" /></Svg>
);
export const IconDrop = (p) => (
  <Svg {...p}><path d="M12 2.7s6 6.6 6 10.5a6 6 0 0 1-12 0C6 9.3 12 2.7 12 2.7Z" /></Svg>
);
