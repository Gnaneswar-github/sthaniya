import sourced from "../../data/destinations.json";
import { score } from "../fuzzy";
import type { Destination, DestinationProvider, DestinationQuery } from "../types";

type Entry = {
  title: string;
  extract: string;
  lat: number | null;
  lng: number | null;
  wikipediaUrl: string | null;
  credit: string;
  imageSourceUrl: string;
};

/**
 * Destinations we hold real content for: a Wikipedia summary and a licensed photograph.
 * This is a content inventory, not a hardcoded world — the OSM provider covers everywhere
 * else, and nothing in the app treats this list as the set of valid destinations.
 */
export const CURATED: Destination[] = Object.entries(sourced as Record<string, Entry>).map(
  ([id, entry]) => ({
    id: `curated:${id}`,
    name: entry.title,
    kind: "city" as const,
    context: "",
    countryName: null,
    countryCode: null,
    region: null,
    coords: entry.lat !== null && entry.lng !== null ? { lat: entry.lat, lng: entry.lng } : null,
    thumbnailUrl: `/destinations/${id}.jpg`,
    thumbnailCredit: entry.credit,
    // No city's recommendations have been checked place by place by a person yet, so none claims to be.
    verified: false,
    guideSlug: id,
    provider: "curated",
  }),
);

export const CURATED_EXTRACTS: Record<string, string> = Object.fromEntries(
  Object.entries(sourced as Record<string, Entry>).map(([id, entry]) => [
    `curated:${id}`,
    entry.extract,
  ]),
);

export class CuratedProvider implements DestinationProvider {
  readonly name = "curated";

  async search({ text, limit = 5 }: DestinationQuery): Promise<Destination[]> {
    // Deliberately strict. A loose threshold lets a shared word through — "New York City"
    // scoring against "Mexico City" on the word "City" — and buries the real geocoder hit.
    return CURATED.map((destination) => ({ destination, relevance: score(text, destination.name) }))
      .filter((hit) => hit.relevance >= 0.6)
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, limit)
      .map((hit) => hit.destination);
  }
}
