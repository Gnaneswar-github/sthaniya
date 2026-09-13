import type { Destination, DestinationKind, DestinationProvider, DestinationQuery } from "../types";

/**
 * OpenStreetMap geocoding. Covers countries, states, regions, islands, cities, towns,
 * neighbourhoods and landmarks worldwide, which is the whole reason we can drop the idea
 * of a fixed destination list.
 *
 * Nominatim's usage policy asks for an identifying User-Agent and modest request rates, so
 * calls are debounced upstream and cached here.
 */

const ENDPOINT = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "Sthaniya/0.4 (residency demo; https://github.com/Gnaneswar-github/sthaniya)";

type NominatimHit = {
  place_id: number;
  name?: string;
  display_name: string;
  lat: string;
  lon: string;
  category?: string;
  type?: string;
  addresstype?: string;
  address?: Record<string, string>;
  /** OSM's own relevance score. Real upstream data, not a popularity figure we invented. */
  importance?: number;
};

/** OSM's vocabulary is granular; ours is what a traveller would recognise. */
function toKind(hit: NominatimHit): DestinationKind {
  const type = (hit.addresstype || hit.type || "").toLowerCase();
  const category = (hit.category || "").toLowerCase();

  if (type === "country") return "country";
  if (type === "state" || type === "province") return "state";
  if (type === "island" || type === "islet" || type === "archipelago") return "island";
  if (type === "region" || type === "county" || type === "district") return "region";
  if (type === "city" || type === "municipality") return "city";
  if (type === "town" || type === "village" || type === "hamlet") return "town";
  if (type === "suburb" || type === "neighbourhood" || type === "quarter" || type === "borough") {
    return "neighbourhood";
  }
  if (category === "tourism" || category === "historic" || category === "leisure") return "landmark";
  return "area";
}

function toDestination(hit: NominatimHit): Destination {
  const address = hit.address ?? {};
  const parts = hit.display_name.split(",").map((part) => part.trim());
  const name = hit.name || parts[0];

  const countryName = address.country ?? null;
  const region =
    address.state ?? address.region ?? address.province ?? address.county ?? null;

  const context = [region, countryName].filter(Boolean).join(", ");

  return {
    id: `osm:${hit.place_id}`,
    name,
    kind: toKind(hit),
    context: context || parts.slice(1).slice(-2).join(", "),
    countryName,
    countryCode: address.country_code ? address.country_code.toUpperCase() : null,
    region,
    coords: { lat: Number(hit.lat), lng: Number(hit.lon) },
    // OSM has no imagery. The UI renders a typed placeholder rather than a broken frame.
    thumbnailUrl: null,
    thumbnailCredit: null,
    verified: false,
    provider: "nominatim",
    relevance: typeof hit.importance === "number" ? hit.importance : undefined,
  };
}

export class NominatimProvider implements DestinationProvider {
  readonly name = "nominatim";

  async search({ text, limit = 8, signal }: DestinationQuery): Promise<Destination[]> {
    const params = new URLSearchParams({
      q: text,
      format: "jsonv2",
      limit: String(limit),
      addressdetails: "1",
      "accept-language": "en",
    });

    const response = await fetch(`${ENDPOINT}?${params}`, {
      headers: { "User-Agent": USER_AGENT },
      next: { revalidate: 86_400 },
      signal: signal ?? AbortSignal.timeout(3500),
    });

    if (!response.ok) throw new Error(`Nominatim responded ${response.status}`);
    return ((await response.json()) as NominatimHit[]).map(toDestination);
  }
}
