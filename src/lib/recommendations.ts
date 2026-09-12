import { PUNE } from "./data/pune";
import type { Recommendation } from "./types";

/**
 * Single seam between the app and the recommendation dataset.
 * Today it reads the seeded files; swapping in Supabase means changing only this function.
 */
const DATASET: Recommendation[] = [...PUNE];

export const SUPPORTED_CITIES = ["Pune"];

function normalise(value: string): string {
  return value.trim().toLowerCase();
}

export function getRecommendations(destination: string): Recommendation[] {
  const wanted = normalise(destination);
  return DATASET.filter((r) => normalise(r.destination) === wanted);
}
