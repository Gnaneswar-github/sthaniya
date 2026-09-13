import type { Coords, Recommendation } from "./types";

/** One line of the /api/generate NDJSON stream. Shared by the route and the page that reads it. */
export type GenerateEvent =
  | { type: "stage"; stage: "locating" | "mapping" | "choosing"; destination?: string; candidates?: number }
  | { type: "place"; place: Recommendation }
  | { type: "done"; meta: DraftMeta }
  | { type: "error"; error: string; retryable: boolean };

export type DraftMeta = {
  destination: string;
  country: string | null;
  coords: Coords;
  candidatesConsidered: number;
  inventedPlacesRejected: number;
  model: string;
  source: string;
};
