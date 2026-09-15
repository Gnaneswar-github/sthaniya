/**
 * Destination domain. Nothing here knows about OpenStreetMap, Wikipedia or any other
 * upstream — providers adapt to this shape so a commercial places API can be dropped in
 * later without the UI noticing.
 */

export type DestinationKind =
  | "country"
  | "state"
  | "region"
  | "island"
  | "city"
  | "town"
  | "neighbourhood"
  | "landmark"
  | "area";

export const KIND_LABEL: Record<DestinationKind, string> = {
  country: "Country",
  state: "State",
  region: "Region",
  island: "Island",
  city: "City",
  town: "Town",
  neighbourhood: "Neighbourhood",
  landmark: "Landmark",
  area: "Area",
};

export type Coords = { lat: number; lng: number };

export type Destination = {
  /** Stable within a provider, prefixed by it: "curated:tokyo", "osm:1234". */
  id: string;
  name: string;
  kind: DestinationKind;
  /** Free-form line under the name: "Kantō, Japan". Empty when we genuinely don't know. */
  context: string;
  countryName: string | null;
  /** ISO 3166-1 alpha-2, used for currency and locale inference. Null when unknown. */
  countryCode: string | null;
  region: string | null;
  coords: Coords | null;
  /** Absent for most of the world — the UI must render without it. */
  thumbnailUrl: string | null;
  /** Present only where we have licensed imagery and owe attribution. */
  thumbnailCredit: string | null;
  /**
   * True only where a human has checked the recommendations behind this destination.
   * Everything else is real but unverified by us, and says so.
   */
  verified: boolean;
  /** Set when Nativa publishes a city guide for this place: a licensed photo, a summary and last year's weather. */
  guideSlug?: string;
  provider: string;
  /**
   * The upstream's own relevance score, 0–1, where it publishes one. Used only to order
   * results — it is not a popularity claim and is never shown as one.
   */
  relevance?: number;
};

export type DestinationQuery = {
  text: string;
  limit?: number;
  signal?: AbortSignal;
};

export interface DestinationProvider {
  readonly name: string;
  search(query: DestinationQuery): Promise<Destination[]>;
}

/**
 * Popularity is a claim about the world, so it needs a source. No provider we have today
 * can supply it; the interface exists so one can, and until then the UI shows nothing
 * rather than inventing a trend line.
 */
export interface PopularityProvider {
  readonly name: string;
  /** Returns null when this provider cannot speak to a destination's popularity. */
  rank(destinationIds: string[]): Promise<Map<string, number> | null>;
}
