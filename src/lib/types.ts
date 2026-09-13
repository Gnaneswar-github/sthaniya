/**
 * Cities with verified data behind them. A city joins this list only once its anchors
 * are checked (PRD §9) — never just because it is on the roadmap.
 */
export const SUPPORTED_CITIES = ["Pune"];

/**
 * Deliberately limited to interests the dataset can actually serve. Offering Nightlife or
 * Wellness with nothing behind them would produce empty days, which is the failure the
 * resilience rule exists to prevent.
 */
export const INTERESTS = [
  { id: "food", label: "Food" },
  { id: "cafes", label: "Cafés" },
  { id: "spiritual", label: "Spiritual" },
  { id: "history", label: "History" },
  { id: "architecture", label: "Architecture" },
  { id: "nature", label: "Nature" },
  { id: "markets", label: "Markets" },
  { id: "photography", label: "Photography" },
  { id: "local_life", label: "Local Life" },
] as const;

export type Interest = (typeof INTERESTS)[number]["id"];

export const DIAL_POSITIONS = [
  {
    id: "tourist",
    label: "Tourist",
    blurb: "The ones you'd genuinely regret missing.",
  },
  {
    id: "local",
    label: "Local",
    blurb: "A few icons, but mostly where people here actually go.",
  },
  {
    id: "insider",
    label: "Insider",
    blurb: "Nothing off a postcard. You'd need a friend here to know these.",
  },
] as const;

export type DialPosition = (typeof DIAL_POSITIONS)[number]["id"];

export const LOCALITY_TAGS = {
  tourist_essential: "Tourist Essential",
  local_favourite: "Local Favourite",
  hidden_gem: "Hidden Gem",
} as const;

export type LocalityTag = keyof typeof LOCALITY_TAGS;

/** Wikimedia Commons image. `credit` must be shown on the card to satisfy CC attribution. */
export type Photo = {
  url: string;
  credit: string;
  sourceUrl: string;
  /** True when the photo was taken close by rather than confirmed to show the place itself. */
  nearby?: boolean;
};

/**
 * What a traveller has shown they like, learned only from their own edits ("More like this",
 * "Not for me") and kept on their device. Counts per category, capped.
 */
export type TasteProfile = {
  likes: Partial<Record<Category, number>>;
  dislikes: Partial<Record<Category, number>>;
};

export const CATEGORIES = {
  food: "Food",
  cafe: "Café",
  temple: "Temple",
  sight: "Sight",
  museum: "Museum",
  market: "Market",
  outdoors: "Outdoors",
} as const;

export type Category = keyof typeof CATEGORIES;

/**
 * Coarse bands rather than exact prices. We have no live pricing source, and inventing an
 * exact figure on a card would be the fabrication the evidence field exists to prevent.
 *
 * `approx` is a per-person planning estimate expressed in the destination's own currency
 * (carried on the record as `costCurrency`), so nothing here assumes a country.
 */
export const PRICE_BANDS = {
  free: { label: "Free", tier: 0, approx: 0 },
  low: { label: "Budget", tier: 1, approx: 120 },
  mid: { label: "Mid-range", tier: 2, approx: 400 },
  high: { label: "Splurge", tier: 3, approx: 1000 },
  /** We have no pricing source outside the verified set, and a guess would read as fact. */
  unknown: { label: "Price unknown", tier: 2, approx: 0 },
} as const;

export type PriceBand = keyof typeof PRICE_BANDS;

export type Coords = { lat: number; lng: number };

/** What Google Maps lists for a place, fetched through Apify. Absent when not configured or not found. */
export type PlaceDetails = {
  rating: number | null;
  reviews: number | null;
  /** e.g. [{ day: "Monday", hours: "9 AM to 5 PM" }] */
  hours: { day: string; hours: string }[];
  priceLevel: string | null;
  url: string | null;
  fetchedAt: string;
};

export type Recommendation = {
  id: string;
  name: string;
  destination: string;
  tag: LocalityTag;
  category: Category;
  priceBand: PriceBand;
  /** Currency the cost estimate is quoted in. Set from the city's data, never assumed. */
  costCurrency?: string;
  /** Typical time on site, in minutes — drives scheduling and the "slow it down" transform. */
  durationMinutes: number;
  coords?: Coords;
  photo?: Photo;
  /** OpenStreetMap `opening_hours`, shown verbatim with its source — never inferred. */
  openingHours?: string;
  /** Wikidata id and "lang:Title" when the map links the place; used to find a real photo. */
  wikidata?: string;
  wikipedia?: string;
  /** Rating, reviews and hours from Google Maps (via Apify), shown with that source. */
  details?: PlaceDetails;
  interests: Interest[];
  /**
   * The window this place is genuinely best in ("HH:MM"), e.g. a temple at dawn.
   * The scheduler honours it where it can and says so when it can't.
   */
  timeWindow: { start: string; end: string };
  vibe: string;
  description: string;
  /** One line per interest this place speaks to, written to the user's chosen interest. */
  whyItFits: Partial<Record<Interest, string>>;
  evidenceSource: string;
  /**
   * A city ships only once every record is checked against a real listing by a human.
   * See PRD §9 — the count of cities is not the bar, verification is.
   */
  verified: boolean;
  /** Editorial rank within its own tag, 1 = strongest. Breaks ties in selection. */
  priority: number;
};

export const TRAVELLER_TYPES = [
  { id: "solo", label: "Solo" },
  { id: "couple", label: "Couple" },
  { id: "friends", label: "Friends" },
  { id: "family", label: "Family" },
  { id: "business", label: "Business" },
] as const;

export type TravellerType = (typeof TRAVELLER_TYPES)[number]["id"];

export const PACES = [
  { id: "relaxed", label: "Relaxed", itemsPerDay: 3, blurb: "Room to linger. Fewer stops, longer at each." },
  { id: "balanced", label: "Balanced", itemsPerDay: 5, blurb: "A full day without rushing it." },
  { id: "packed", label: "Packed", itemsPerDay: 7, blurb: "You want to see everything. Bring good shoes." },
] as const;

export type Pace = (typeof PACES)[number]["id"];

export type TripPrefs = {
  destination: string;
  /** ISO dates, "YYYY-MM-DD". */
  startDate: string;
  endDate: string;
  travellerType: TravellerType;
  interests: Interest[];
  /** The locality dial, carried over from v1 — it remains the product's differentiator. */
  dial: DialPosition;
  pace: Pace;
  /** Kept in the currency the traveller typed. We have no FX source, so we don't convert. */
  budgetPerDay: number;
  budgetCurrency: string;
  /** The original sentence. Richer signal than any checkbox, so it is never silently dropped. */
  notes: string;
  /** Learned from this traveller's own edits on this device. Optional: a first trip has none. */
  taste?: TasteProfile;
  /** Multi-city route, in order. Present only for two or more cities; `destination` then reads "A → B". */
  legs?: { destination: string; days: number }[];
};

export type ItineraryItem = {
  itemId: string;
  place: Recommendation;
  /** Minutes from midnight. Owned by the scheduler, rewritten on every edit. */
  startMinutes: number;
  durationMinutes: number;
  /** Set when the place could not be given its preferred window. */
  offPreferredWindow?: boolean;
};

export type TripDay = {
  /** ISO date, "YYYY-MM-DD". */
  date: string;
  /** Set on multi-city trips: the city this day is spent in. */
  destination?: string;
  items: ItineraryItem[];
};

export type Trip = {
  id: string;
  prefs: TripPrefs;
  days: TripDay[];
  /** Plain-language shortfalls and explanations, surfaced rather than hidden. */
  notes: string[];
  createdAt: string;
};

