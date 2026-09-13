import { resolvePhotos, type PhotoRequest } from "@/lib/places/photos";

export const maxDuration = 30;

/** POST { places: PhotoRequest[] } → { photos: { [id]: Photo } }. Unmatched places are omitted. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { places?: PhotoRequest[] } | null;
  const places = (body?.places ?? [])
    .filter((p) => typeof p?.id === "string" && typeof p?.name === "string")
    .slice(0, 40);

  if (places.length === 0) return Response.json({ photos: {} });

  const photos = await resolvePhotos(places);
  return Response.json({ photos });
}
