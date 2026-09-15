import { createGenerator, GroqError } from "@/lib/ai/groq";
import { groundedPlace } from "@/lib/ai/place";
import { landmarkCandidates } from "@/lib/landmarks";
import { destinationService } from "@/lib/destinations/service";
import type { GenerateEvent } from "@/lib/generate-events";
import { categoryFromFacts } from "@/lib/grounding";
import { fetchGroundedCandidates } from "@/lib/places/overpass";
import { seasonFor } from "@/lib/season";
import { perDayLimit } from "@/lib/trip-engine";
import type { TripPrefs } from "@/lib/types";

/**
 * Builds a place set for any destination on earth, streamed as it happens:
 *
 *   resolve the destination     → geocoders
 *   retrieve real candidates    → OpenStreetMap (cached a week) or Wikipedia, with their facts
 *   select, sequence, write     → Groq, streamed place by place
 *   validate and ground         → before anything is sent
 *
 * The response is NDJSON — one event per line — so the page can show progress and the first
 * stops within seconds instead of a spinner for the whole trip.
 */

export const maxDuration = 120;

// Wikipedia geosearch returns articles about the city and its districts too; an area is not a
// place to go. Same class of mistake: a Tbilisi draft once offered a metro station as a stop.
const ADMIN_AREA = /\b(district|province|region|municipality|department|prefecture|governorate|oblast|county|metropolitan area|commune|canton)$/i;
const TRANSIT = /\((?:[^)]*\b)?(metro|subway|underground|tram|railway|mrt|lrt)\b[^)]*\)|\b(station|airport|bus terminal|interchange)\b/i;

export async function POST(request: Request) {
  const generator = createGenerator();
  if (!generator) {
    return Response.json({ error: "Itinerary generation is not configured." }, { status: 503 });
  }

  const prefs = (await request.json().catch(() => null)) as TripPrefs | null;
  if (!prefs?.destination?.trim()) {
    return Response.json({ error: "A destination is required." }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: GenerateEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));

      try {
        send({ type: "stage", stage: "locating" });
        const { results } = await destinationService.search(prefs.destination, 1);
        const place = results[0];
        if (!place?.coords) {
          send({ type: "error", error: `We couldn't find ${prefs.destination} on the map. Try the city's full name?`, retryable: false });
          return;
        }

        send({ type: "stage", stage: "mapping", destination: place.name });
        const grounded = await fetchGroundedCandidates(place.coords);
        const destinationKey = place.name.toLowerCase();
        const candidates = grounded.candidates
          .filter((c) => c.name.toLowerCase() !== destinationKey && !ADMIN_AREA.test(c.name.trim()) && !TRANSIT.test(c.name))
          // Sixty is plenty to choose a few days from, and keeps a draft inside the token budget.
          .slice(0, 60);

        // What the model had to choose from, by kind — so a missing coffee stop or temple is
        // traceable to the map rather than guessed at.
        const counts: Record<string, number> = {};
        for (const candidate of candidates) {
          const kind = categoryFromFacts(candidate.facts, candidate.name);
          counts[kind] = (counts[kind] ?? 0) + 1;
        }
        console.info("[generate] candidates", place.name, grounded.source, JSON.stringify(counts));

        if (candidates.length === 0) {
          send({ type: "error", error: `Let's try somewhere nearby — the map is quiet around ${place.name} right now.`, retryable: true });
          return;
        }

        send({ type: "stage", stage: "choosing", destination: place.name, candidates: candidates.length });

        const days = Math.max(1, Math.round((Date.parse(prefs.endDate) - Date.parse(prefs.startDate)) / 86_400_000) + 1);
        const perDay = perDayLimit(prefs);

        let count = 0;
        let rejected = 0;
        let model = generator.model;
        const sent = new Set<string>();
        for await (const event of generator.stream({
          destination: place.name,
          countryName: place.countryName,
          countryCode: place.countryCode,
          region: place.region,
          candidates,
          prefs,
          season: seasonFor(prefs.startDate, place.coords.lat),
          target: Math.min(days * perDay + 3, 24),
        })) {
          if (event.type === "place") {
            count += 1;
            sent.add(event.place.name);
            send({ type: "place", place: event.place });
          } else {
            rejected = event.rejected;
            model = event.model;
          }
        }

        if (count === 0) {
          send({ type: "error", error: `The trip drafter is busy right now. Give it a few seconds and try ${prefs.destination} again.`, retryable: true });
          return;
        }

        // The town's landmarks are always considered, even when the model passed over them. They
        // come from the candidate list — real places — and the trip engine decides whether they
        // fit (kept at Tourist and Local, listed as "You're skipping" at Insider).
        for (const landmark of landmarkCandidates(candidates, prefs.interests)) {
          if (sent.has(landmark.name)) continue;
          count += 1;
          const stop = groundedPlace(
            { ref: landmark.ref, interests: prefs.interests, durationMinutes: 75, window: { start: "09:00", end: "11:00" } },
            landmark,
            { destination: place.name, brief: prefs.notes ?? "", region: place.region, countryCode: place.countryCode, priority: count },
          );
          send({ type: "place", place: { ...stop, evidenceSource: "openstreetmap+landmark" } });
        }

        send({
          type: "done",
          meta: {
            destination: place.name,
            country: place.countryName,
            coords: place.coords,
            candidatesConsidered: candidates.length,
            inventedPlacesRejected: rejected,
            model,
            source: grounded.source,
          },
        });
      } catch (error) {
        // Details go to the logs. Travellers get a sentence they can act on.
        console.error("[generate]", prefs.destination, error);
        const busy = error instanceof GroqError && error.retryable;
        send({
          type: "error",
          error: busy
            ? `The trip drafter is busy right now. Give it a few seconds and try ${prefs.destination} again.`
            : `We couldn't draft a trip for ${prefs.destination} just now. Please try again in a moment.`,
          retryable: true,
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
