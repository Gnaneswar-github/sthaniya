import type { Coords } from "@/lib/destinations/types";
import { distanceKm } from "../geo";
import type { Candidate } from "./overpass";

/**
 * Wikipedia geosearch: every article with coordinates near a point.
 *
 * Exists because the public Overpass instance is genuinely unreliable — identical queries
 * succeed and time out minutes apart. This is a thinner source (landmarks and institutions,
 * not cafés) but a dependable one, so a traveller still gets real places when OSM is down.
 */

type GeoHit = { pageid: number; title: string; lat: number; lon: number };

const USER_AGENT = "Nativa/0.7 (residency demo; https://github.com/Gnaneswar-github/sthaniya)";

const INSTITUTIONAL =
  /\b(university|college|school|academy of sciences|institute|court|ministry|embassy|consulate|headquarters|bank of|hospital|clinic|archives?|library|agency|authority|corporation|company|office building|business centre|business center|police|prison|barracks|stadium|arena|hotel|nightclub|night club)\b|\(country\)|\(company\)/i;

const EVENTS = /\b(stampede|fire|attack|bombing|massacre|disaster|riots?|election|accident|crash|flood|earthquake|tsunami|cyclone|incident|siege|battle|explosion|shooting|collapse)\b/i;

/** Article lengths in bytes, fifty pages per request. Missing lengths simply don't count. */
async function articleLengths(pageids: number[]): Promise<Map<number, number>> {
  const lengths = new Map<number, number>();
  for (let i = 0; i < pageids.length; i += 50) {
    const params = new URLSearchParams({ action: "query", prop: "info", pageids: pageids.slice(i, i + 50).join("|"), format: "json", origin: "*" });
    try {
      const response = await fetch(`https://en.wikipedia.org/w/api.php?${params}`, {
        headers: { "User-Agent": USER_AGENT },
        next: { revalidate: 604_800 },
        signal: AbortSignal.timeout(6000),
      });
      const pages = ((await response.json()) as { query?: { pages?: Record<string, { pageid?: number; length?: number }> } }).query?.pages ?? {};
      for (const page of Object.values(pages)) {
        if (page.pageid && page.length) lengths.set(page.pageid, page.length);
      }
    } catch {
      // Lengths only refine the ranking; the places stand without them.
    }
  }
  return lengths;
}

export async function fetchWikiCandidates(coords: Coords, limit = 100): Promise<Candidate[]> {
  const params = new URLSearchParams({
    action: "query",
    list: "geosearch",
    gscoord: `${coords.lat}|${coords.lng}`,
    gsradius: "10000",
    gslimit: String(Math.min(limit, 100)),
    format: "json",
    origin: "*",
  });

  const response = await fetch(`https://en.wikipedia.org/w/api.php?${params}`, {
    headers: { "User-Agent": USER_AGENT },
    next: { revalidate: 86_400 },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`Wikipedia geosearch ${response.status}`);

  const hits = (((await response.json()) as { query?: { geosearch?: GeoHit[] } }).query?.geosearch ?? [])
    // Articles about administrative areas aren't places you visit.
    .filter((hit) => !/^(List of|\d{4})/.test(hit.title))
    // Geosearch is sorted by distance, so a city centre fills up with the buildings that
    // happen to have articles. A deployed Tbilisi draft offered a bank's headquarters, the
    // Supreme Court and four universities to someone who asked for food and old churches.
    .filter((hit) => !INSTITUTIONAL.test(hit.title))
    // Articles about events share coordinates with places ("Mahamaham stampede"); an event is not a stop.
    .filter((hit) => !EVENTS.test(hit.title));

  const lengths = await articleLengths(hits.map((hit) => hit.pageid));

  return hits.map((hit, index) => ({
    ref: `w${index}`,
    name: hit.title,
    kind: "place with a Wikipedia article",
    coords: { lat: hit.lat, lng: hit.lon },
    // Everything here has an article, which is the prominence signal itself.
    notable: true,
    facts: {
      hasWikipedia: true,
      ...(lengths.has(hit.pageid) ? { articleLength: lengths.get(hit.pageid) } : {}),
      distanceKm: Math.round(distanceKm(coords, { lat: hit.lat, lng: hit.lon }) * 10) / 10,
    },
    wikipedia: `en:${hit.title}`,
  }));
}
