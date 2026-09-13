import { unstable_cache } from "next/cache";
import { readEnv } from "@/lib/env";
import type { Coords, PlaceDetails } from "@/lib/types";

/**
 * Ratings, review counts and opening hours from Google Maps, fetched through Apify's Google Maps
 * scraper (compass/crawler-google-places) instead of the Google Places API.
 *
 * Only active when APIFY_TOKEN is set. Each place is looked up once and cached for two weeks, so
 * cost scales with new places, not with visitors. A result is only accepted if Google's pin sits
 * within 1.5 km of our map coordinates — otherwise it's probably a namesake, and we show nothing
 * rather than someone else's rating.
 *
 * Note for operators: scraping Google Maps sits outside Google's own terms of service. That is a
 * business decision this code makes easy to switch off (unset the token).
 */

const ACTOR = "compass~crawler-google-places";

type ApifyPlace = {
  title?: string;
  totalScore?: number | null;
  reviewsCount?: number | null;
  openingHours?: { day?: string; hours?: string }[];
  price?: string | null;
  url?: string | null;
  location?: { lat?: number; lng?: number } | null;
};

export const apifyConfigured = () => Boolean(readEnv("APIFY_TOKEN"));

function distanceKm(a: Coords, b: Coords) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

async function scrape(query: string, lat: number | null, lng: number | null): Promise<PlaceDetails | null> {
  const token = readEnv("APIFY_TOKEN");
  if (!token) return null;

  const response = await fetch(
    `https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items?timeout=90&memory=1024`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        searchStringsArray: [query],
        maxCrawledPlacesPerSearch: 1,
        language: "en",
        maxReviews: 0,
        maxImages: 0,
        scrapeReviewsPersonalData: false,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(100_000),
    },
  );
  // Throwing (rather than returning null) keeps failures out of the cache.
  if (!response.ok) throw new Error(`Apify responded ${response.status}`);

  const place = ((await response.json()) as ApifyPlace[])[0];
  if (!place) return null;

  const pin = place.location;
  if (lat !== null && lng !== null && pin?.lat != null && pin?.lng != null && distanceKm({ lat, lng }, { lat: pin.lat, lng: pin.lng }) > 1.5) {
    return null;
  }

  return {
    rating: typeof place.totalScore === "number" ? Math.round(place.totalScore * 10) / 10 : null,
    reviews: typeof place.reviewsCount === "number" ? place.reviewsCount : null,
    hours: (place.openingHours ?? [])
      .filter((h): h is { day: string; hours: string } => typeof h.day === "string" && typeof h.hours === "string")
      .slice(0, 7),
    priceLevel: place.price ?? null,
    url: place.url ?? null,
    fetchedAt: new Date().toISOString(),
  };
}

export const placeDetails = unstable_cache(scrape, ["apify-place-details-v1"], { revalidate: 1_209_600 });
