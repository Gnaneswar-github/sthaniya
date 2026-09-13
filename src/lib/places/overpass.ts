import type { Coords } from "@/lib/destinations/types";
import { fetchWikiCandidates } from "./wikigeo";

/**
 * Real, named places around a point, straight from OpenStreetMap.
 *
 * This exists so the language model never has to remember a city. It selects and describes
 * from these candidates instead of recalling restaurants from training data, which is where
 * invented addresses and long-closed cafés come from.
 */

export type Candidate = {
  /** Short id the model refers to. Anything it returns outside this set is dropped. */
  ref: string;
  name: string;
  /** Raw OSM tags we kept, so the model can reason from facts rather than vibes. */
  kind: string;
  coords: Coords;
  /** True when OSM links this place to a Wikipedia article — a real prominence signal. */
  notable: boolean;
  cuisine?: string;
  website?: string;
  openingHours?: string;
};

const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

type OverpassElement = {
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

/**
 * Nodes for points of interest, ways only for parks (which are rarely a single point).
 * `nwr` across every clause reliably 504s on the public instance — this shape is what it
 * actually serves.
 */
function buildQuery(coords: Coords, radiusMetres: number): string {
  const at = `around:${radiusMetres},${coords.lat},${coords.lng}`;
  return `[out:json][timeout:18];
(
  node(${at})[tourism][name];
  node(${at})[historic][name];
  node(${at})[amenity~"^(cafe|restaurant|marketplace|place_of_worship|theatre|arts_centre)$"][name];
  way(${at})[leisure~"^(park|garden)$"][name];
);
out tags center 200;`;
}

const LATIN = /^[\p{Script=Latin}\p{N}\p{P}\p{Zs}]+$/u;

/**
 * "Kiyomizu-dera (清水寺)" rather than either alone. If the local name is already Latin
 * script there's nothing to add, and if there's no English name we use what the map has.
 */
function displayName(tags: Record<string, string>): string {
  const local = tags.name;
  const english = tags["name:en"];

  if (!english || english === local) return local;
  if (LATIN.test(local)) return local;
  return `${english} (${local})`;
}

function describeKind(tags: Record<string, string>): string {
  return (
    tags.tourism ??
    tags.historic ??
    tags.amenity ??
    tags.leisure ??
    tags.shop ??
    "place"
  ).replace(/_/g, " ");
}

/**
 * GET, not POST. The main Overpass instance answers GET promptly but 504s on POST from here,
 * and the mirror times out entirely — so the request shape is load-bearing, not incidental.
 */
async function query(endpoint: string, body: string, signal: AbortSignal): Promise<OverpassElement[]> {
  const response = await fetch(`${endpoint}?data=${encodeURIComponent(body)}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Sthaniya/0.7 (residency demo; https://github.com/Gnaneswar-github/sthaniya)",
    },
    signal,
  });
  if (!response.ok) throw new Error(`Overpass ${response.status}`);
  return ((await response.json()) as { elements?: OverpassElement[] }).elements ?? [];
}

const BUCKETS = ["eat", "culture", "worship", "green", "other"] as const;

function bucketOf(kind: string): (typeof BUCKETS)[number] {
  if (/cafe|restaurant|ice cream|food court|marketplace|bakery|deli/.test(kind)) return "eat";
  if (/museum|gallery|artwork|attraction|viewpoint|theatre|arts centre|memorial|monument|ruins|castle|archaeological|building|tomb/.test(kind)) return "culture";
  if (/place of worship|church|temple|mosque|shrine/.test(kind)) return "worship";
  if (/park|garden|nature reserve/.test(kind)) return "green";
  return "other";
}

/**
 * A city has far more restaurants mapped than museums, so an unbalanced list hands the model
 * a menu and nothing else — the first Colombo draft came back as eight cafés in a row. Taking
 * turns across buckets gives it a palette that can actually answer "history and local life".
 */
function balance(candidates: Candidate[], limit: number): Candidate[] {
  const groups = new Map<string, Candidate[]>();
  for (const bucket of BUCKETS) groups.set(bucket, []);

  for (const candidate of candidates) {
    groups.get(bucketOf(candidate.kind))!.push(candidate);
  }
  // Notable first within each bucket, so the best of each kind survives the cut.
  for (const group of groups.values()) {
    group.sort((a, b) => Number(b.notable) - Number(a.notable));
  }

  const picked: Candidate[] = [];
  let exhausted = false;
  while (picked.length < limit && !exhausted) {
    exhausted = true;
    for (const bucket of BUCKETS) {
      const group = groups.get(bucket)!;
      const next = group.shift();
      if (!next) continue;
      exhausted = false;
      picked.push(next);
      if (picked.length >= limit) break;
    }
  }

  return picked.map((candidate, index) => ({ ...candidate, ref: `p${index}` }));
}

/**
 * Widens the search until it finds enough to work with — a dense old city needs 3km, a
 * spread-out one needs 12km, and guessing one number for the world would fail both.
 */
export async function fetchCandidates(coords: Coords, limit = 90): Promise<Candidate[]> {
  // A tight budget on purpose: an earlier version spent 114s exhausting retries before
  // admitting defeat, which is far worse for the traveller than a fast, honest failure.
  const deadline = Date.now() + 24_000;
  const radii = [4000, 12000];

  for (const radius of radii) {
    for (const endpoint of ENDPOINTS) {
      if (Date.now() > deadline) return [];
      try {
        const remaining = Math.max(4000, deadline - Date.now());
        const elements = await query(
          endpoint,
          buildQuery(coords, radius),
          // A single slow mirror mustn't eat the whole budget before the others get a turn.
          AbortSignal.timeout(Math.min(remaining, 12_000)),
        );

        const candidates: Candidate[] = [];
        for (const element of elements) {
          const tags = element.tags ?? {};
          const lat = element.lat ?? element.center?.lat;
          const lon = element.lon ?? element.center?.lon;
          if (!tags.name || lat === undefined || lon === undefined) continue;

          candidates.push({
            ref: `p${candidates.length}`,
            // OSM's `name` is in the local script, so a Kyoto trip came back entirely in
            // Japanese. Prefer the English name where the map has one, keeping the local
            // name alongside it — the traveller needs both: one to read, one to point at.
            name: displayName(tags),
            kind: describeKind(tags),
            coords: { lat, lng: lon },
            notable: Boolean(tags.wikipedia || tags.wikidata || tags.heritage),
            cuisine: tags.cuisine,
            website: tags.website,
            openingHours: tags.opening_hours,
          });
        }

        const ranked = balance(candidates, limit);

        if (ranked.length >= 12) return ranked;
        if (radius === radii.at(-1) && ranked.length > 0) return ranked;
      } catch {
        // Try the mirror, then a wider radius, before giving up entirely.
      }
    }
  }

  return [];
}

/**
 * Real places for a point, from whichever source is actually up. Overpass is richer, so it
 * leads; Wikipedia geosearch is thinner but dependable, so it catches the fall.
 */
export async function fetchGroundedCandidates(
  coords: Coords,
): Promise<{ candidates: Candidate[]; source: string }> {
  // Both start at once. Waiting for Overpass to fail before asking Wikipedia cost a Marrakech
  // traveller 24 dead seconds; in parallel, the fallback is already in hand when it's needed.
  const wiki = fetchWikiCandidates(coords).catch(() => [] as Candidate[]);
  const fromOsm = await fetchCandidates(coords);
  if (fromOsm.length >= 12) return { candidates: fromOsm, source: "openstreetmap" };

  try {
    const fromWiki = await wiki;
    if (fromWiki.length === 0) {
      return { candidates: fromOsm, source: "openstreetmap" };
    }

    // Both when we have both: OSM brings the everyday places, Wikipedia the landmarks.
    const merged = [...fromOsm, ...fromWiki].map((candidate, index) => ({
      ...candidate,
      ref: `p${index}`,
    }));
    return {
      candidates: merged,
      source: fromOsm.length > 0 ? "openstreetmap+wikipedia" : "wikipedia",
    };
  } catch {
    return { candidates: fromOsm, source: "openstreetmap" };
  }
}
