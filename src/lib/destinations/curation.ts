import { normalise } from "./fuzzy";
import { CURATED, CURATED_EXTRACTS } from "./providers/curated";
import type { Destination } from "./types";

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

export const MOODS = [
  { id: "slow", label: "Slow", prompt: "A slow few days with quiet mornings, long breakfasts and no fixed plans" },
  { id: "romantic", label: "Romantic", prompt: "A romantic trip — sunsets, small restaurants and walks worth taking slowly" },
  { id: "curious", label: "Curious", prompt: "A curious trip — odd museums, old neighbourhoods and things I can't explain to people back home" },
  { id: "energetic", label: "Energetic", prompt: "An energetic trip — long days, lots of ground covered, no wasted afternoons" },
  { id: "peaceful", label: "Peaceful", prompt: "Somewhere peaceful — parks, quiet temples and places I can sit without being hurried" },
  { id: "cultural", label: "Cultural", prompt: "A cultural trip — heritage, local food, markets and the neighbourhoods people actually live in" },
  { id: "adventurous", label: "Adventurous", prompt: "An adventurous trip — hills, early starts and getting properly out of the city" },
  { id: "creative", label: "Creative", prompt: "A creative trip — photography, good light, texture and street life" },
];

export { CURATED as DESTINATIONS };
