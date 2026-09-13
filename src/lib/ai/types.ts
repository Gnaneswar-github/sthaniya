import type { Candidate } from "@/lib/places/overpass";
import type { Recommendation, TripPrefs } from "@/lib/types";

/**
 * The model is a reasoning and writing layer over real places, never the source of the places
 * themselves. Implementations are handed grounded candidates and must return selections drawn
 * from that set; the caller enforces it.
 */
export interface ItineraryGenerator {
  readonly name: string;
  readonly model: string;
  generate(input: GenerationInput): Promise<GenerationResult>;
}

export type GenerationInput = {
  destination: string;
  /** Where in the world, for season and daylight reasoning. */
  countryName: string | null;
  candidates: Candidate[];
  prefs: TripPrefs;
  /** Northern/southern hemisphere season at the travel dates, computed not guessed. */
  season: string;
  /** How many places to return. Derived from pace and trip length. */
  target: number;
};

export type GenerationResult = {
  places: Recommendation[];
  /** Candidate refs the model returned that did not exist. Surfaced, never silently dropped. */
  rejected: string[];
  model: string;
};
