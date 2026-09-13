import type { Coords } from "@/lib/destinations/types";
import type { Candidate } from "./overpass";

/**
 * Wikipedia geosearch: every article with coordinates near a point.
 *
 * Exists because the public Overpass instance is genuinely unreliable — identical queries
 * succeed and time out minutes apart. This is a thinner source (landmarks and institutions,
 * not cafés) but a dependable one, so a traveller still gets real places when OSM is down.
 */

type GeoHit = { pageid: number; title: string; lat: number; lon: number };

export async function fetchWikiCandidates(coords: Coords, limit = 60): Promise<Candidate[]> {
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
    headers: {
      "User-Agent": "Sthaniya/0.7 (residency demo; https://github.com/Gnaneswar-github/sthaniya)",
    },
    next: { revalidate: 86_400 },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`Wikipedia geosearch ${response.status}`);

  const hits = ((await response.json()) as { query?: { geosearch?: GeoHit[] } }).query?.geosearch ?? [];

  return hits
    // Articles about administrative areas aren't places you visit.
    .filter((hit) => !/^(List of|\d{4})/.test(hit.title))
    .map((hit, index) => ({
      ref: `w${index}`,
      name: hit.title,
      kind: "place with a Wikipedia article",
      coords: { lat: hit.lat, lng: hit.lon },
      // Everything here has an article, which is the prominence signal itself.
      notable: true,
    }));
}
