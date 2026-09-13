import { createGenerator, GroqError } from "@/lib/ai/groq";
import { destinationService } from "@/lib/destinations/service";
import { fetchGroundedCandidates } from "@/lib/places/overpass";
import { PACES, type TripPrefs } from "@/lib/types";

/**
 * Builds a place set for any destination on earth:
 *
 *   resolve the destination  → OpenStreetMap
 *   retrieve real candidates → OpenStreetMap (Overpass)
 *   select, sequence, write  → Groq
 *   validate against candidates → here
 *
 * The model never supplies a place name. It chooses among places that demonstrably exist.
 */

/**
 * Map retrieval plus a model call can take most of a minute when Overpass is busy. The
 * platform default would cut the request off mid-draft, which is worse than waiting.
 */
export const maxDuration = 120;

/** Seasons differ by hemisphere; a December trip is not winter everywhere. */
function seasonFor(isoDate: string, lat: number | null): string {
  const month = new Date(isoDate).getUTCMonth();
  if (Number.isNaN(month)) return "unknown season";

  const northern = ["winter", "winter", "spring", "spring", "spring", "summer", "summer", "summer", "autumn", "autumn", "autumn", "winter"];
  const season = northern[month];
  if (lat === null) return season;

  if (lat >= -23.5 && lat <= 23.5) {
    return month >= 4 && month <= 9 ? "tropical wet season" : "tropical dry season";
  }

  if (lat < 0) {
    const flipped: Record<string, string> = { winter: "summer", summer: "winter", spring: "autumn", autumn: "spring" };
    return flipped[season] ?? season;
  }
  return season;
}

export async function POST(request: Request) {
  const generator = createGenerator();
  if (!generator) {
    return Response.json(
      { error: "Itinerary generation is not configured.", places: [] },
      { status: 503 },
    );
  }

  const prefs = (await request.json().catch(() => null)) as TripPrefs | null;
  if (!prefs?.destination?.trim()) {
    return Response.json({ error: "A destination is required.", places: [] }, { status: 400 });
  }

  try {
    const { results } = await destinationService.search(prefs.destination, 1);
    const place = results[0];
    if (!place?.coords) {
      return Response.json(
        { error: `We couldn't find ${prefs.destination} on the map.`, places: [] },
        { status: 404 },
      );
    }

    const grounded = await fetchGroundedCandidates(place.coords);
    // Sixty is plenty to choose a few days from, and keeps one draft well inside the
    // per-minute token allowance — ninety candidates alone ate half of it.
    const candidates = grounded.candidates.slice(0, 60);
    const { source } = grounded;
    if (candidates.length === 0) {
      return Response.json(
        {
          error: `OpenStreetMap has very little mapped around ${place.name}, so there's nothing solid to build from.`,
          places: [],
        },
        { status: 422 },
      );
    }

    const days = Math.max(
      1,
      Math.round((Date.parse(prefs.endDate) - Date.parse(prefs.startDate)) / 86_400_000) + 1,
    );
    const perDay = PACES.find((p) => p.id === prefs.pace)?.itemsPerDay ?? 5;

    const result = await generator.generate({
      destination: place.name,
      countryName: place.countryName,
      candidates,
      prefs,
      season: seasonFor(prefs.startDate, place.coords.lat),
      target: Math.min(days * perDay + 3, 24),
    });

    return Response.json({
      places: result.places,
      meta: {
        destination: place.name,
        country: place.countryName,
        candidatesConsidered: candidates.length,
        // Surfaced rather than hidden: it's the signal that grounding is doing its job.
        inventedPlacesRejected: result.rejected.length,
        model: result.model,
        source,
      },
    });
  } catch (error) {
    // The detail goes to the logs. Travellers get a sentence they can act on, not a runtime
    // exception — the last one leaked a ByteString error straight into the page.
    console.error("[generate]", prefs.destination, error);
    const busy = error instanceof GroqError && error.retryable;
    return Response.json(
      {
        error: busy
          ? `The trip drafter is busy right now. Give it a few seconds and try ${prefs.destination} again.`
          : `We couldn't draft a trip for ${prefs.destination} just now. Please try again in a moment.`,
        places: [],
      },
      { status: 502 },
    );
  }
}
