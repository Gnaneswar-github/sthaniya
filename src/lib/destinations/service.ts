import { expandAlias } from "./aliases";
import { normalise, score } from "./fuzzy";
import { CURATED, CuratedProvider } from "./providers/curated";
import { NominatimProvider } from "./providers/nominatim";
import type { Destination, DestinationProvider, PopularityProvider } from "./types";

/**
 * Composes destination providers behind one call. Curated results lead because we hold real
 * content for them; everything else comes from the geocoder, so the app has no fixed idea of
 * which places exist.
 */
export class DestinationService {
  constructor(
    private readonly providers: DestinationProvider[],
    private readonly popularity: PopularityProvider | null = null,
  ) {}

  async search(text: string, limit = 8): Promise<{ results: Destination[]; degraded: boolean }> {
    const query = expandAlias(text);
    if (normalise(query).length < 2) return { results: [], degraded: false };

    const settled = await Promise.allSettled(
      this.providers.map((provider) => provider.search({ text: query, limit })),
    );
    // One provider failing narrows the list; it must never empty the search box.
    const degraded = settled.some((outcome) => outcome.status === "rejected");

    const merged = settled.flatMap((outcome) =>
      outcome.status === "fulfilled" ? outcome.value : [],
    );

    const ranked = merged
      .map((destination) => ({
        destination,
        rank:
          score(query, destination.name) +
          // Curated entries lead because we hold real content for them, not because they
          // are better places.
          (destination.provider === "curated" ? 1 : 0) +
          (destination.verified ? 0.3 : 0) +
          // Among everything else, defer to the geocoder's own relevance. That's what puts
          // London, England above London, Ontario — OSM's judgement, not a rule we wrote.
          (destination.relevance ?? 0) * 1.2,
      }))
      .sort((a, b) => b.rank - a.rank)
      .map((hit) => hit.destination);

    // Dedupe after ranking so the better-described copy of a place survives — providers
    // disagree about context ("Tokyo" vs "Tokyo, Japan") and only one should be offered.
    const seen = new Set<string>();
    const results: Destination[] = [];
    for (const destination of ranked) {
      const key = `${normalise(destination.name)}|${destination.kind}`;
      if (seen.has(key)) continue;
      seen.add(key);
      results.push(destination);
      if (results.length >= limit) break;
    }

    return { results, degraded };
  }

  /** Null whenever no provider can substantiate popularity — the UI then shows no badge. */
  async popularityFor(destinations: Destination[]): Promise<Map<string, number> | null> {
    if (!this.popularity) return null;
    try {
      return await this.popularity.rank(destinations.map((d) => d.id));
    } catch {
      return null;
    }
  }
}

export const destinationService = new DestinationService([
  new CuratedProvider(),
  new NominatimProvider(),
]);

/** Shown before the traveller types anything. Real content, not a popularity claim. */
export function starterDestinations(limit = 8): Destination[] {
  return [...CURATED].sort((a, b) => Number(b.verified) - Number(a.verified)).slice(0, limit);
}
