import { buildItinerary } from "@/lib/itinerary";
import { getRecommendations } from "@/lib/recommendations";
import { DIAL_POSITIONS, INTERESTS, TIME_BUCKETS, type ItineraryRequest } from "@/lib/types";

function parse(body: unknown): ItineraryRequest | null {
  if (typeof body !== "object" || body === null) return null;
  const { destination, timeBucket, interests, dial } = body as Record<string, unknown>;

  if (typeof destination !== "string" || destination.trim() === "") return null;
  if (!TIME_BUCKETS.some((b) => b.id === timeBucket)) return null;
  if (!DIAL_POSITIONS.some((d) => d.id === dial)) return null;
  if (!Array.isArray(interests) || interests.length === 0) return null;
  if (!interests.every((i) => INTERESTS.some((known) => known.id === i))) return null;

  return {
    destination: destination.trim(),
    timeBucket: timeBucket as ItineraryRequest["timeBucket"],
    interests: interests as ItineraryRequest["interests"],
    dial: dial as ItineraryRequest["dial"],
  };
}

export async function POST(request: Request) {
  const parsed = parse(await request.json().catch(() => null));
  if (!parsed) {
    return Response.json({ error: "Invalid itinerary request." }, { status: 400 });
  }

  const pool = await getRecommendations(parsed.destination);
  return Response.json(buildItinerary(pool, parsed));
}
