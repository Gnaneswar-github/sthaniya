import type { Coords, Photo } from "@/lib/types";

/**
 * Real photographs for places, from Wikimedia — licensed, credited, and never a stock image
 * pretending to be somewhere. In order of confidence:
 *
 *   1. the Wikidata image the map links to           → a photo of this place
 *   2. the lead image of the linked Wikipedia article → a photo of this place
 *   3. a Wikipedia article right by it that names it → that article's lead photo
 *   4. a Commons photo whose title names the place   → very likely this place
 *   5. the nearest Commons photo within ~150 m       → marked "Taken nearby", not claimed as the place
 *
 * Generic words ("temple", "park") never count as a name match.
 *
 * Every lookup is cached for a week, so a city's photos are fetched once, not per traveller.
 */

export type PhotoRequest = {
  id: string;
  name: string;
  coords?: Coords;
  wikidata?: string;
  wikipedia?: string;
};

const USER_AGENT = "Sthaniya/0.8 (travel planner; https://github.com/Gnaneswar-github/sthaniya)";

type ApiResponse = Record<string, unknown>;

async function api(host: string, params: Record<string, string>): Promise<ApiResponse> {
  const query = new URLSearchParams({ format: "json", formatversion: "2", ...params });
  const response = await fetch(`https://${host}/w/api.php?${query}`, {
    headers: { "User-Agent": USER_AGENT },
    next: { revalidate: 604_800 },
    signal: AbortSignal.timeout(6000),
  });
  if (!response.ok) throw new Error(`${host} responded ${response.status}`);
  return (await response.json()) as ApiResponse;
}

const stripHtml = (html: string) => html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();

type ImageInfo = {
  thumburl?: string;
  descriptionurl?: string;
  mime?: string;
  extmetadata?: Record<string, { value?: string }>;
};

async function commonsFile(fileName: string, nearby: boolean): Promise<Photo | null> {
  const title = fileName.startsWith("File:") ? fileName : `File:${fileName}`;
  const data = await api("commons.wikimedia.org", {
    action: "query",
    prop: "imageinfo",
    iiprop: "url|extmetadata|mime",
    iiurlwidth: "720",
    titles: title,
  });
  const pages = (data.query as { pages?: { imageinfo?: ImageInfo[] }[] } | undefined)?.pages;
  const info = pages?.[0]?.imageinfo?.[0];
  if (!info?.thumburl || !/^image\/(jpeg|png|webp)$/.test(info.mime ?? "")) return null;

  const meta = info.extmetadata ?? {};
  const artist = stripHtml(meta.Artist?.value ?? "") || "Wikimedia Commons";
  const license = stripHtml(meta.LicenseShortName?.value ?? "");
  return {
    url: info.thumburl,
    credit: `${artist}${license ? ` / ${license}` : ""}`.slice(0, 120),
    sourceUrl: info.descriptionurl ?? `https://commons.wikimedia.org/wiki/${encodeURIComponent(title)}`,
    nearby,
  };
}

async function fromWikidata(id: string): Promise<Photo | null> {
  if (!/^Q\d+$/.test(id)) return null;
  const data = await api("www.wikidata.org", { action: "wbgetclaims", entity: id, property: "P18" });
  const claims = data.claims as { P18?: { mainsnak?: { datavalue?: { value?: string } } }[] } | undefined;
  const file = claims?.P18?.[0]?.mainsnak?.datavalue?.value;
  return file ? commonsFile(file, false) : null;
}

async function fromWikipedia(link: string): Promise<Photo | null> {
  const match = /^([a-z-]{2,12}):(.+)$/.exec(link);
  if (!match) return null;
  const [, lang, title] = match;
  const data = await api(`${lang}.wikipedia.org`, {
    action: "query",
    prop: "pageimages",
    piprop: "name",
    redirects: "1",
    titles: title,
  });
  const pages = (data.query as { pages?: { pageimage?: string }[] } | undefined)?.pages;
  const file = pages?.[0]?.pageimage;
  return file ? commonsFile(file, false) : null;
}

/**
 * Words that say what kind of place something is, not which one. Matching on them made any
 * temple photo nearby look like a photo of *this* temple, so they never count as a name match.
 */
const GENERIC = new Set([
  "temple", "shrine", "church", "mosque", "cathedral", "chapel", "monastery", "park", "garden", "gardens",
  "museum", "gallery", "market", "restaurant", "cafe", "coffee", "house", "hall", "tower", "bridge",
  "street", "road", "avenue", "square", "station", "centre", "center", "building", "palace", "castle",
  "city", "old", "new", "great", "national", "public", "view", "from", "with", "night", "image", "photo",
  "jpeg", "file", "wikimedia",
]);

const tokens = (text: string) =>
  text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length >= 4 && !GENERIC.has(t));

const namesMatch = (a: string, b: string) => {
  const wanted = new Set(tokens(a));
  return wanted.size > 0 && tokens(b).some((t) => wanted.has(t));
};

/** A Wikipedia article right by the place whose title names it — then that article's lead photo. */
async function fromNearbyArticle(name: string, coords: Coords): Promise<Photo | null> {
  const data = await api("en.wikipedia.org", {
    action: "query",
    list: "geosearch",
    gscoord: `${coords.lat}|${coords.lng}`,
    gsradius: "200",
    gslimit: "10",
  });
  const hits = (data.query as { geosearch?: { title: string }[] } | undefined)?.geosearch ?? [];
  const match = hits.find((hit) => namesMatch(name, hit.title));
  return match ? fromWikipedia(`en:${match.title}`) : null;
}

async function fromNearby(name: string, coords: Coords): Promise<Photo | null> {
  const data = await api("commons.wikimedia.org", {
    action: "query",
    list: "geosearch",
    gsnamespace: "6",
    gscoord: `${coords.lat}|${coords.lng}`,
    gsradius: "150",
    gslimit: "20",
  });
  const hits = ((data.query as { geosearch?: { title: string; dist: number }[] } | undefined)?.geosearch ?? []).filter(
    (hit) => /\.(jpe?g|png|webp)$/i.test(hit.title),
  );
  if (hits.length === 0) return null;

  const named = hits.find((hit) => namesMatch(name, hit.title));
  if (named) return commonsFile(named.title, false);

  // No photo names the place, so show the closest one and say so on the card.
  const nearest = [...hits].sort((a, b) => a.dist - b.dist)[0];
  return commonsFile(nearest.title, true);
}

export async function resolvePhoto(request: PhotoRequest): Promise<Photo | null> {
  const attempts: (() => Promise<Photo | null>)[] = [];
  if (request.wikidata) attempts.push(() => fromWikidata(request.wikidata!));
  if (request.wikipedia) attempts.push(() => fromWikipedia(request.wikipedia!));
  if (request.coords) {
    attempts.push(() => fromNearbyArticle(request.name, request.coords!));
    attempts.push(() => fromNearby(request.name, request.coords!));
  }

  for (const attempt of attempts) {
    try {
      const photo = await attempt();
      if (photo) return photo;
    } catch {
      // One source failing just moves us to the next.
    }
  }
  return null;
}

/** Resolves a batch with modest concurrency — Wikimedia is generous, but not unlimited. */
export async function resolvePhotos(requests: PhotoRequest[], concurrency = 6): Promise<Record<string, Photo>> {
  const results: Record<string, Photo> = {};
  const queue = [...requests];
  await Promise.all(
    Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
      for (let next = queue.shift(); next; next = queue.shift()) {
        const photo = await resolvePhoto(next);
        if (photo) results[next.id] = photo;
      }
    }),
  );
  return results;
}
