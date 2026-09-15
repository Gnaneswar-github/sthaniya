import { normalise } from "./fuzzy";
import { CURATED, CURATED_EXTRACTS } from "./providers/curated";
import type { Destination } from "./types";
import type { CityPick } from "../moods";

export function destinationById(id: string): Destination | undefined {
  return CURATED.find((d) => d.id === id || d.id === `curated:${id}`);
}

export function destinationByName(name: string): Destination | undefined {
  const wanted = normalise(name);
  return CURATED.find((d) => normalise(d.name) === wanted);
}

export function extractFor(destination: Destination): string | undefined {
  return CURATED_EXTRACTS[destination.id];
}

/**
 * Today's picks: a daily rotation through the destinations we hold photography for. Deliberately
 * not called "trending" — we have no usage data, and a fabricated trend line would be the same
 * failure as a fabricated restaurant. It is simply a different, fair shuffle each day.
 */
export function dailyPicks(count: number, date = new Date()): Destination[] {
  let seed = Math.floor(date.getTime() / 86_400_000);
  const random = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const pool = [...CURATED];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

export { MOODS } from "../moods";

export { CURATED as DESTINATIONS };

/** Cities with a licensed photo, reduced to what a homepage card shows. */
export function cityPicks(ids?: string[]): CityPick[] {
  const chosen = ids ? ids.map((id) => CURATED.find((d) => d.id === id)).filter((d): d is Destination => Boolean(d)) : CURATED;
  return chosen.filter((d) => d.thumbnailUrl).map(({ id, name, thumbnailUrl }) => ({ id, name, thumbnailUrl }));
}
