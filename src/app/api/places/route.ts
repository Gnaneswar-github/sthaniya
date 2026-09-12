import { getRecommendations } from "@/lib/recommendations";

/**
 * Hands the client the whole place pool for a destination once. Every subsequent edit —
 * replace, remove, cheaper, slower — then runs locally and lands instantly, which is the
 * point of v2: the itinerary behaves like a document, not like a query you re-run.
 */
export async function GET(request: Request) {
  const destination = new URL(request.url).searchParams.get("destination")?.trim();
  if (!destination) {
    return Response.json({ error: "Missing destination." }, { status: 400 });
  }

  return Response.json({ places: await getRecommendations(destination) });
}
