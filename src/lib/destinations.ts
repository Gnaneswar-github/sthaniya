import sourced from "./data/destinations.json";
import { SUPPORTED_CITIES } from "./types";

/**
 * Two tiers, always distinguishable in the UI:
 *
 *  - "verified" — our own editorial set, checked by a human. Pune today.
 *  - "sourced"  — real places from Wikipedia and OpenStreetMap. Genuinely global, genuinely
 *                 real, but never dressed up in our editorial voice and never presented as
 *                 something we have stood behind.
 *
 * The distinction is the whole reason this product exists, so it is a field, not a footnote.
 */
export type Tier = "verified" | "sourced";

export type Destination = {
  id: string;
  name: string;
  /** Straight from Wikipedia. We do not rewrite it, so we cannot embellish it. */
  extract: string;
  coords: { lat: number; lng: number } | null;
  imageUrl: string;
  credit: string;
  imageSourceUrl: string;
  wikipediaUrl: string | null;
  tier: Tier;
};

type SourcedEntry = {
  title: string;
  extract: string;
  lat: number | null;
  lng: number | null;
  wikipediaUrl: string | null;
  credit: string;
  imageSourceUrl: string;
};

const verifiedNames = new Set(SUPPORTED_CITIES.map((c) => c.toLowerCase()));

export const DESTINATIONS: Destination[] = Object.entries(sourced as Record<string, SourcedEntry>).map(
  ([id, entry]) => ({
    id,
    name: entry.title,
    extract: entry.extract,
    coords: entry.lat !== null && entry.lng !== null ? { lat: entry.lat, lng: entry.lng } : null,
    imageUrl: `/destinations/${id}.jpg`,
    credit: entry.credit,
    imageSourceUrl: entry.imageSourceUrl,
    wikipediaUrl: entry.wikipediaUrl,
    tier: verifiedNames.has(entry.title.toLowerCase()) ? "verified" : "sourced",
  }),
);

export function destinationById(id: string): Destination | undefined {
  return DESTINATIONS.find((d) => d.id === id);
}

export function destinationByName(name: string): Destination | undefined {
  const wanted = name.trim().toLowerCase();
  return DESTINATIONS.find(
    (d) => d.name.toLowerCase() === wanted || d.id === wanted.replace(/\s+/g, "-"),
  );
}

/**
 * Editorial rails. Deliberately not called "trending" — we have no usage data, and a
 * fabricated trend line would be the same sin as a fabricated restaurant.
 */
export const RAILS: { id: string; title: string; blurb: string; destinationIds: string[] }[] = [
  {
    id: "live",
    title: "Where Sthānīya is live",
    blurb: "Cities with a human-checked set behind them. These build a full itinerary.",
    destinationIds: DESTINATIONS.filter((d) => d.tier === "verified").map((d) => d.id),
  },
  {
    id: "layered",
    title: "Cities that reward a second look",
    blurb: "Places where the everyday is more interesting than the landmark.",
    destinationIds: ["hanoi", "istanbul", "george-town-penang", "oaxaca", "tbilisi"],
  },
  {
    id: "on-foot",
    title: "Best walked, not toured",
    blurb: "Dense, old and built long before cars. Put the map away.",
    destinationIds: ["lisbon", "kyoto", "marrakesh", "varanasi", "mexico-city"],
  },
];

export const MOODS = [
  { id: "slow", label: "Slow mornings", prompt: "A slow few days with quiet mornings, long breakfasts and no fixed plans" },
  { id: "eat", label: "Here to eat", prompt: "A food-first trip — markets, street food and places locals actually queue at" },
  { id: "old", label: "Old streets", prompt: "Old neighbourhoods, lived-in architecture and long walks with no particular destination" },
  { id: "green", label: "Out of the city", prompt: "Hills, water and green space, with early starts and few people around" },
  { id: "solo", label: "Travelling alone", prompt: "A solo trip where I can wander, read in cafés and not feel out of place eating by myself" },
  { id: "camera", label: "Shooting film", prompt: "A photography trip — good light, texture, street life and no crowds in the frame" },
];

export const CATEGORIES = [
  { id: "food", label: "Food & markets", hint: "Where a city eats on a normal Tuesday" },
  { id: "spiritual", label: "Temples & quiet", hint: "Working places of worship, not monuments" },
  { id: "history", label: "History", hint: "Told through streets and objects, not plaques" },
  { id: "nature", label: "Green & high", hint: "Hills, gardens and water inside the city" },
  { id: "markets", label: "Markets", hint: "Bargaining, not boutiques" },
  { id: "photography", label: "Photography", hint: "Light, texture and everyday life" },
];
