import type { Destination, DestinationKind, DestinationProvider, DestinationQuery } from "../types";

/**
 * Open-Meteo's geocoder, built on GeoNames. Keyless and fast, and — unlike Nominatim — it
 * doesn't throttle shared cloud IPs, which is exactly where production runs. It only knows
 * populated places and admin areas, so it backs Nominatim up rather than replacing it.
 */

const ENDPOINT = "https://geocoding-api.open-meteo.com/v1/search";

type GeoNamesHit = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  feature_code?: string;
  country?: string;
  country_code?: string;
  admin1?: string;
  population?: number;
};

function toKind(code = ""): DestinationKind {
  if (code.startsWith("PCL")) return "country";
  if (code === "ADM1") return "state";
  if (code.startsWith("ADM")) return "region";
  if (code === "ISL" || code === "ISLS") return "island";
  if (code === "PPLX") return "neighbourhood";
  if (code === "PPLC" || code === "PPLA" || code === "PPLA2") return "city";
  if (code.startsWith("PPL")) return "town";
  return "area";
}

export class OpenMeteoProvider implements DestinationProvider {
  readonly name = "open-meteo";

  async search({ text, limit = 8, signal }: DestinationQuery): Promise<Destination[]> {
    const params = new URLSearchParams({
      name: text,
      count: String(Math.min(limit, 10)),
      language: "en",
      format: "json",
    });

    const response = await fetch(`${ENDPOINT}?${params}`, {
      next: { revalidate: 86_400 },
      signal: signal ?? AbortSignal.timeout(4000),
    });
    if (!response.ok) throw new Error(`Open-Meteo geocoding responded ${response.status}`);

    const hits = ((await response.json()) as { results?: GeoNamesHit[] }).results ?? [];

    return hits.map((hit) => ({
      id: `geonames:${hit.id}`,
      name: hit.name,
      kind: toKind(hit.feature_code),
      context: [hit.admin1, hit.country].filter(Boolean).join(", "),
      countryName: hit.country ?? null,
      countryCode: hit.country_code ? hit.country_code.toUpperCase() : null,
      region: hit.admin1 ?? null,
      coords: { lat: hit.latitude, lng: hit.longitude },
      thumbnailUrl: null,
      thumbnailCredit: null,
      verified: false,
      provider: "open-meteo",
      // Population is a real prominence signal: it puts Paris, France above Paris, Texas.
      // Log-scaled into the same 0..1 band Nominatim's importance uses.
      relevance: hit.population ? Math.min(1, Math.log10(hit.population) / 8) : 0.2,
    }));
  }
}
