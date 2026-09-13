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
 * Editorial rails. Deliberately none of them is called "trending": we have no usage data,
 * and a fabricated trend line would be the same failure as a fabricated restaurant. The
 * PopularityProvider interface exists for when a real signal is available.
 */
export const RAILS: { id: string; title: string; blurb: string; destinationIds: string[] }[] = [
  {
    id: "live",
    title: "Where Sthānīya is live",
    blurb: "Cities with a human-checked set behind them. These build a full itinerary.",
    destinationIds: CURATED.filter((d) => d.verified).map((d) => d.id),
  },
  {
    id: "layered",
    title: "Cities that reward a second look",
    blurb: "Places where the everyday is more interesting than the landmark.",
    destinationIds: ["curated:hanoi", "curated:istanbul", "curated:george-town-penang", "curated:oaxaca", "curated:tbilisi"],
  },
  {
    id: "on-foot",
    title: "Best walked, not toured",
    blurb: "Dense, old and built long before cars. Put the map away.",
    destinationIds: ["curated:lisbon", "curated:kyoto", "curated:marrakesh", "curated:varanasi", "curated:mexico-city"],
  },
];

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

export const INTEREST_TILES = [
  { id: "food", label: "Food", hint: "Where a city eats on a normal Tuesday" },
  { id: "spiritual", label: "Temples & quiet", hint: "Working places of worship, not monuments" },
  { id: "history", label: "History", hint: "Told through streets and objects, not plaques" },
  { id: "nature", label: "Nature", hint: "Hills, gardens and water inside the city" },
  { id: "markets", label: "Markets", hint: "Bargaining, not boutiques" },
  { id: "photography", label: "Photography", hint: "Light, texture and everyday life" },
  { id: "architecture", label: "Architecture", hint: "Buildings people still live and work in" },
  { id: "cafes", label: "Cafés", hint: "Somewhere to sit for an hour" },
];

export { CURATED as DESTINATIONS };
