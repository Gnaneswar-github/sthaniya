import { apifyConfigured, placeDetails } from "@/lib/places/apify";
import type { Coords, PlaceDetails } from "@/lib/types";

export const maxDuration = 120;

type Request_ = { id: string; name: string; destination: string; coords?: Coords };

/**
 * POST { places } → { configured, details: { [id]: PlaceDetails } }.
 * Up to 12 places per call, looked up four at a time; unmatched places are simply omitted.
 */
export async function POST(request: Request) {
  if (!apifyConfigured()) return Response.json({ configured: false, details: {} });

  const body = (await request.json().catch(() => null)) as { places?: Request_[] } | null;
  const places = (body?.places ?? []).filter((p) => typeof p?.id === "string" && typeof p?.name === "string").slice(0, 12);

  const details: Record<string, PlaceDetails> = {};
  const queue = [...places];
  await Promise.all(
    Array.from({ length: Math.min(4, queue.length) }, async () => {
      for (let place = queue.shift(); place; place = queue.shift()) {
        try {
          const found = await placeDetails(`${place.name}, ${place.destination}`, place.coords?.lat ?? null, place.coords?.lng ?? null);
          if (found) details[place.id] = found;
        } catch (error) {
          console.error("[place-details]", place.name, error);
        }
      }
    }),
  );

  return Response.json({ configured: true, details });
}
