import { destinationService, starterDestinations } from "@/lib/destinations/service";

/**
 * Global destination search. With no query it returns starters so the selector has something
 * real to show on open; with one it fans out across providers.
 */
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";

  if (query.length < 2) {
    return Response.json({ results: starterDestinations(), degraded: false, starter: true });
  }

  try {
    const { results, degraded } = await destinationService.search(query);
    return Response.json({ results, degraded, starter: false });
  } catch {
    return Response.json(
      { results: [], degraded: true, starter: false, error: "Destination search is unavailable." },
      { status: 503 },
    );
  }
}
