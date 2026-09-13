import sourced from "./data/destinations.json";

/** City guides: the destinations we hold a licensed photo and a Wikipedia summary for. */
export type Guide = {
  slug: string;
  name: string;
  extract: string;
  lat: number | null;
  lng: number | null;
  wikipediaUrl: string | null;
  photo: string;
  credit: string;
  photoSourceUrl: string;
};

type Entry = {
  title: string;
  extract: string;
  lat: number | null;
  lng: number | null;
  wikipediaUrl: string | null;
  credit: string;
  imageSourceUrl: string;
};

export const GUIDES: Guide[] = Object.entries(sourced as Record<string, Entry>).map(([slug, entry]) => ({
  slug,
  name: entry.title,
  extract: entry.extract,
  lat: entry.lat,
  lng: entry.lng,
  wikipediaUrl: entry.wikipediaUrl,
  photo: `/destinations/${slug}.jpg`,
  credit: entry.credit,
  photoSourceUrl: entry.imageSourceUrl,
}));

export const guideBySlug = (slug: string) => GUIDES.find((g) => g.slug === slug);

export const firstSentences = (text: string, count = 2) =>
  (text.match(/[^.!?]+[.!?]+/g) ?? [text]).slice(0, count).join(" ").trim();
