import { useId } from "react";
import type { Category } from "@/lib/types";

/**
 * Artwork for a place we have no photograph of — never a grey box, and never a stock photo
 * pretending to be the place. The colours, contour lines and light are derived from the name,
 * so every place gets its own look and the same place always looks the same; the glyph says
 * what kind of place it is.
 */

const PALETTES: [string, string, string][] = [
  ["#0f5e47", "#2fbf87", "#d9f5e8"],
  ["#0d2f42", "#3f7fa0", "#cfe6f2"],
  ["#8a5a12", "#f5c164", "#fff1cf"],
  ["#8f3f28", "#e79a6b", "#ffe3d2"],
  ["#1f5f58", "#6fc2b0", "#dcf4ee"],
  ["#34563f", "#a3c48a", "#eaf4df"],
  ["#4b2f5c", "#c0719a", "#f6dbe8"],
  ["#2b4560", "#7fa3c7", "#e1ecf7"],
];

const GLYPHS: Record<Category | "place", ReactPathSet> = {
  food: ["M4 12h16a8 8 0 0 1-16 0Z", "M9 4.5c-1 1.4 1 2.4 0 4", "M13 4.5c-1 1.4 1 2.4 0 4", "M17 4.5c-1 1.4 1 2.4 0 4"],
  cafe: ["M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5Z", "M16 10.5h1.5a2.5 2.5 0 0 1 0 5H16", "M9 3.5c-.8 1.2.8 2 0 3.3", "M12.5 3.5c-.8 1.2.8 2 0 3.3"],
  // Tiered roofs, so a temple doesn't read as a house.
  temple: [
    "M12 2.5V5",
    "M6 8.5c2 0 4-1.2 6-3.5 2 2.3 4 3.5 6 3.5",
    "M8.5 8.5v3",
    "M15.5 8.5v3",
    "M3.5 14c2.5 0 5-1 8.5-2.5 3.5 1.5 6 2.5 8.5 2.5",
    "M6.5 14v6",
    "M17.5 14v6",
    "M3 20h18",
    "M10.5 20v-3.5h3V20",
  ],
  sight: ["M12 3.5l2.5 5.2 5.7.8-4.1 4 1 5.7L12 16.5l-5.1 2.7 1-5.7-4.1-4 5.7-.8Z"],
  museum: ["M3 9l9-5 9 5", "M4 9h16", "M6.5 9v9", "M10.2 9v9", "M13.8 9v9", "M17.5 9v9", "M3 20h18"],
  market: ["M4 10l1.5-5h13L20 10", "M4 10a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0", "M5 10v10h14V10", "M10 20v-5h4v5"],
  outdoors: ["M3 19l6-9 4 6 3-4 5 7Z", "M17 7.5a2 2 0 1 0 0-.01"],
  place: ["M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z", "M12 12.6a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2Z"],
};

type ReactPathSet = string[];

function hash(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function PlaceArt({
  name,
  category,
  className = "",
  glyphSize = 34,
}: {
  name: string;
  category?: Category;
  className?: string;
  /** Glyph size as a percentage of the artwork's shorter side. */
  glyphSize?: number;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const seed = hash(name);
  const [deep, mid, light] = PALETTES[seed % PALETTES.length];
  const angle = (seed >>> 3) % 360;
  const cx = 30 + ((seed >>> 7) % 140);
  const cy = 20 + ((seed >>> 11) % 120);
  const sunX = 40 + ((seed >>> 13) % 120);
  const glyph = GLYPHS[category ?? "place"] ?? GLYPHS.place;
  const size = (160 * glyphSize) / 100;

  return (
    <svg
      aria-hidden
      viewBox="0 0 200 160"
      preserveAspectRatio="xMidYMid slice"
      className={className}
    >
      <defs>
        <linearGradient id={`g${uid}`} gradientTransform={`rotate(${angle % 90} .5 .5)`}>
          <stop offset="0" stopColor={deep} />
          <stop offset="1" stopColor={mid} />
        </linearGradient>
        <radialGradient id={`s${uid}`}>
          <stop offset="0" stopColor={light} stopOpacity=".55" />
          <stop offset="1" stopColor={light} stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="200" height="160" fill={`url(#g${uid})`} />
      <circle cx={sunX} cy="30" r="70" fill={`url(#s${uid})`} />

      {/* Map-like contour lines: a nod to the fact that every place here is a real point on a map. */}
      <g fill="none" stroke={light} strokeOpacity=".16" strokeWidth="1.2" transform={`rotate(${angle} ${cx} ${cy})`}>
        {[18, 34, 52, 72, 94, 118].map((r, i) => (
          <ellipse key={r} cx={cx} cy={cy} rx={r * 1.35} ry={r * (0.7 + ((seed >>> i) % 5) * 0.05)} />
        ))}
      </g>

      <g
        transform={`translate(${100 - size / 2} ${80 - size / 2}) scale(${size / 24})`}
        fill="none"
        stroke="#ffffff"
        strokeOpacity=".92"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {glyph.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
    </svg>
  );
}
