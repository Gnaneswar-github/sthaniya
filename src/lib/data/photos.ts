import type { Photo } from "../types";
import sources from "./photos.json";

/**
 * Wikimedia Commons photos. The files are vendored into public/photos by
 * scripts/download-photos.mjs — Wikimedia rate-limits hotlinking, and a 429 on stage
 * is not a risk worth taking. Every CC licence here still requires visible credit.
 * Places with no entry fall back to the generated card visual.
 */
export const PHOTOS: Record<string, Photo> = Object.fromEntries(
  Object.entries(sources).map(([id, source]) => [
    id,
    { url: `/photos/${id}.jpg`, credit: source.credit, sourceUrl: source.sourceUrl },
  ]),
);
