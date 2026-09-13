import { DESTINATIONS } from "@/lib/destinations";

/**
 * Global destination lookup. Curated entries first (we have real content behind those),
 * then OpenStreetMap for everywhere else on earth. Nominatim asks for a identifying
 * User-Agent and considerate rates, so results are cached for a day.
 */

type Suggestion = {
  id: string;
  name: string;
  context: string;
  tier: "verified" | "sourced";
  coords: { lat: number; lng: number } | null;
};

const NOMINATIM = "https://nominatim.openstreetmap.org/search";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) return Response.json({ suggestions: [] });

  const needle = query.toLowerCase();
  const curated: Suggestion[] = DESTINATIONS.filter((d) => d.name.toLowerCase().includes(needle))
    .slice(0, 4)
    .map((d) => ({
      id: d.id,
      name: d.name,
      context: d.tier === "verified" ? "Verified by us" : "On Sthānīya",
      tier: d.tier,
      coords: d.coords,
    }));

  let remote: Suggestion[] = [];
  try {
    const params = new URLSearchParams({
      q: query,
      format: "jsonv2",
      limit: "6",
      featuretype: "city",
      addressdetails: "1",
    });
    const response = await fetch(`${NOMINATIM}?${params}`, {
      headers: { "User-Agent": "Sthaniya/0.3 (residency demo; https://github.com/Gnaneswar-github/sthaniya)" },
      next: { revalidate: 86_400 },
      signal: AbortSignal.timeout(2500),
    });

    if (response.ok) {
      type Hit = { name?: string; display_name: string; lat: string; lon: string; place_id: number };
      const hits = (await response.json()) as Hit[];
      remote = hits
        .map((hit) => {
          const parts = hit.display_name.split(",").map((p) => p.trim());
          return {
            id: `osm-${hit.place_id}`,
            name: hit.name || parts[0],
            context: parts.slice(1).filter(Boolean).slice(-2).join(", "),
            tier: "sourced" as const,
            coords: { lat: Number(hit.lat), lng: Number(hit.lon) },
          };
        })
        .filter((hit) => !curated.some((c) => c.name.toLowerCase() === hit.name.toLowerCase()));
    }
  } catch {
    // A slow or unreachable geocoder should narrow the list, never break the search box.
  }

  return Response.json({ suggestions: [...curated, ...remote].slice(0, 8) });
}
