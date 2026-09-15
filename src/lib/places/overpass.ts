import type { Coords } from "@/lib/destinations/types";
import { distanceKm } from "../geo";
import type { PlaceFacts } from "../types";
import { fetchWikiCandidates } from "./wikigeo";

/**
 * Real, named places around a point, straight from OpenStreetMap, joined with Wikipedia's
 * geolocated articles.
 *
 * This exists so the language model never has to remember a city. It selects from these
 * candidates instead of recalling restaurants from training data, which is where invented
 * addresses and long-closed cafés come from. Each candidate carries its verifiable facts, which
 * are the only things any text about it may say.
 */

export type Candidate = {
  /** Short id the model refers to. Anything it returns outside this set is dropped. */
  ref: string;
  name: string;
  /** A readable kind from the main OSM tag, for balancing the list. */
  kind: string;
  coords: Coords;
  /** True when OSM or Wikipedia links this place to an article, Wikidata or a heritage register. */
  notable: boolean;
  facts: PlaceFacts;
  cuisine?: string;
  website?: string;
  openingHours?: string;
  /** Links the map carries to Wikidata / Wikipedia — the most reliable route to a real photo. */
  wikidata?: string;
  wikipedia?: string;
};

const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

type OverpassElement = {
  id: number;
  type?: string;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

/**
 * Nodes for points of interest, ways only for parks (which are rarely a single point).
 *
 * Kept byte-for-byte stable on purpose: responses are cached for a week per URL, so an unchanged
 * query keeps serving a town's places on the days the public instance is down. Heavier shapes —
 * `nwr`, ways for temples, key filters — measured as timeouts there, so landmarks mapped as
 * compounds come from Wikipedia instead (see `mergeWikipedia`).
 */
function buildQuery(coords: Coords, radiusMetres: number): string {
  const at = `around:${radiusMetres},${coords.lat},${coords.lng}`;
  return `[out:json][timeout:18];
(
  node(${at})[tourism][tourism!~"^(hotel|hostel|guest_house|motel|apartment|chalet|camp_site|caravan_site|information|alpine_hut)$"][name];
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
  return (tags.tourism ?? tags.historic ?? tags.amenity ?? tags.leisure ?? tags.natural ?? tags.shop ?? "place").replace(/_/g, " ");
}

function factsFrom(tags: Record<string, string>, distance: number): PlaceFacts {
  const facts: PlaceFacts = {
    amenity: tags.amenity,
    tourism: tags.tourism,
    historic: tags.historic,
    leisure: tags.leisure,
    natural: tags.natural,
    religion: tags.religion,
    denomination: tags.denomination,
    cuisine: tags.cuisine,
    wheelchair: tags.wheelchair,
    fee: tags.fee,
    heritage: tags.heritage,
    brand: tags.brand,
    website: tags.website ?? tags["contact:website"],
    openingHours: tags.opening_hours,
    hasWikipedia: Boolean(tags.wikipedia),
    hasWikidata: Boolean(tags.wikidata),
    distanceKm: Math.round(distance * 10) / 10,
  };
  // Drop empty keys: facts travel inside share links, so they should stay small.
  return Object.fromEntries(Object.entries(facts).filter(([, value]) => value !== undefined && value !== false)) as PlaceFacts;
}

/**
 * GET, not POST. The main Overpass instance answers GET promptly but 504s on POST from here,
 * and the mirror times out entirely — so the request shape is load-bearing, not incidental.
 */
async function query(endpoint: string, body: string, signal: AbortSignal, variant = ""): Promise<OverpassElement[]> {
  const response = await fetch(`${endpoint}?data=${encodeURIComponent(body)}${variant}`, {
    headers: {
      Accept: "application/json",
      // Unchanged, like the query: the cache key includes it.
      "User-Agent": "Nativa/0.7 (residency demo; https://github.com/Gnaneswar-github/sthaniya)",
    },
    // Cached for a week per query. The map around a city barely changes, and this turns the
    // slowest step of every trip — often 10–25 seconds — into a one-off per destination.
    next: { revalidate: 604_800 },
    signal,
  });
  if (!response.ok) throw new Error(`Overpass ${response.status}`);
  const result = (await response.json()) as { elements?: OverpassElement[]; remark?: string };
  // A query that ran out of time still answers 200 — with no elements and a remark saying so — and
  // a 200 is cached for the week. One retry under a different URL keeps a single timeout from hiding
  // a town's places until the cache expires; Overpass ignores the extra parameter.
  if (result.remark && /timed out|runtime error|out of memory/i.test(result.remark) && !result.elements?.length) {
    if (!variant) return query(endpoint, body, signal, `&retry=${Math.floor(Date.now() / 3_600_000)}`);
    throw new Error(`Overpass: ${result.remark.slice(0, 80)}`);
  }
  return result.elements ?? [];
}

const BUCKETS = ["eat", "culture", "worship", "green", "other"] as const;

function bucketOf(kind: string): (typeof BUCKETS)[number] {
  if (/cafe|restaurant|ice cream|food court|marketplace|bakery|deli/.test(kind)) return "eat";
  if (/museum|gallery|artwork|attraction|viewpoint|theatre|arts centre|memorial|monument|ruins|castle|archaeological|building|tomb/.test(kind)) return "culture";
  if (/place of worship|church|temple|mosque|shrine/.test(kind)) return "worship";
  if (/park|garden|nature reserve|water/.test(kind)) return "green";
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

const GENERIC_WORDS = /\b(?:sri|shri|arulmigu|thirumigu|temple|kovil|koil|church|cathedral|mosque|masjid|the)\b/gi;

/** "Arulmigu Sarangapani Temple" and "Sarangapani Temple (Kumbakonam)" are the same place. */
function nameKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/,.*$/, "")
    .replace(GENERIC_WORDS, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function sameName(a: string, b: string): boolean {
  const x = nameKey(a);
  const y = nameKey(b);
  return x.length >= 4 && y.length >= 4 && (x === y || x.includes(y) || y.includes(x));
}

/** A place mapped twice close together shows up twice; keep the better-described copy. */
function dedupe(candidates: Candidate[]): Candidate[] {
  const kept: Candidate[] = [];
  const richness = (c: Candidate) => Object.keys(c.facts).length + (c.notable ? 5 : 0);
  for (const candidate of [...candidates].sort((a, b) => richness(b) - richness(a))) {
    const twin = kept.find((k) => sameName(k.name, candidate.name) && distanceKm(k.coords, candidate.coords) < 0.4);
    if (!twin) kept.push(candidate);
  }
  return kept;
}

function toCandidate(element: OverpassElement, centre: Coords, index: number): Candidate | null {
  const tags = element.tags ?? {};
  const lat = element.lat ?? element.center?.lat;
  const lon = element.lon ?? element.center?.lon;
  if (!tags.name || lat === undefined || lon === undefined) return null;
  const point = { lat, lng: lon };

  return {
    ref: `p${index}`,
    // OSM's `name` is in the local script, so a Kyoto trip came back entirely in
    // Japanese. Prefer the English name where the map has one, keeping the local
    // name alongside it — the traveller needs both: one to read, one to point at.
    name: displayName(tags),
    kind: describeKind(tags),
    coords: point,
    notable: Boolean(tags.wikipedia || tags.wikidata || tags.heritage),
    facts: factsFrom(tags, distanceKm(centre, point)),
    cuisine: tags.cuisine,
    website: tags.website,
    openingHours: tags.opening_hours,
    wikidata: tags.wikidata,
    wikipedia: tags.wikipedia,
  };
}

/**
 * Widens the search until it finds enough to work with — a dense old city needs 4km, a
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

        const candidates = elements
          .map((element, index) => toCandidate(element, coords, index))
          .filter((candidate): candidate is Candidate => candidate !== null);
        const ranked = balance(dedupe(candidates), limit);

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
 * Wikipedia's geolocated articles are how a town's landmarks get considered even when the map lists
 * plenty of everyday places — and when a temple is mapped as a compound the point query can't see.
 * A map entry that matches an article gains its link, a real prominence signal; articles with no
 * map entry join the list as places of their own.
 */
export function mergeWikipedia(fromOsm: Candidate[], fromWiki: Candidate[]): Candidate[] {
  const merged = fromOsm.map((candidate) => ({ ...candidate, facts: { ...candidate.facts } }));
  for (const article of fromWiki) {
    const twin = merged.find((candidate) => sameName(candidate.name, article.name) && distanceKm(candidate.coords, article.coords) < 0.8);
    if (twin) {
      if (!twin.wikipedia) twin.wikipedia = article.wikipedia;
      twin.facts.hasWikipedia = true;
      if (article.facts.articleLength) twin.facts.articleLength = article.facts.articleLength;
      twin.notable = true;
    } else {
      merged.push(article);
    }
  }
  return merged;
}

/**
 * Real places for a point. Overpass brings the everyday places and Wikipedia the landmarks; both
 * start at once, so neither waits for the other to fail.
 */
export async function fetchGroundedCandidates(coords: Coords): Promise<{ candidates: Candidate[]; source: string }> {
  const wiki = fetchWikiCandidates(coords).catch(() => [] as Candidate[]);
  const fromOsm = await fetchCandidates(coords);
  const fromWiki = await wiki;

  const source = fromOsm.length > 0 && fromWiki.length > 0 ? "openstreetmap+wikipedia" : fromOsm.length > 0 ? "openstreetmap" : "wikipedia";
  return { candidates: balance(mergeWikipedia(fromOsm, fromWiki), 90), source };
}
