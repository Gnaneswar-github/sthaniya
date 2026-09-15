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

/**
 * How well known a place is. Drafted places get these from map evidence, never from the model:
 * "Hidden Gem" is reserved for places with real local evidence, so a place that merely lacks a
 * Wikipedia page is a "Small local place", not a gem.
 */
export const LOCALITY_TAGS = {
  tourist_essential: "Tourist Essential",
  local_favourite: "Local Favourite",
  hidden_gem: "Hidden Gem",
  small_local: "Small local place",
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
  church: "Church",
  mosque: "Mosque",
  worship: "Place of worship",
  sight: "Sight",
  museum: "Museum",
  market: "Market",
  outdoors: "Outdoors",
} as const;

export type Category = keyof typeof CATEGORIES;

export const WORSHIP_CATEGORIES: Category[] = ["temple", "church", "mosque", "worship"];

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

/**
 * The verifiable facts behind a drafted place, straight from OpenStreetMap and Wikipedia. Every
 * word shown about a place, its category, its label and its local score are derived from these.
 */
export type PlaceFacts = {
  amenity?: string;
  tourism?: string;
  historic?: string;
  leisure?: string;
  natural?: string;
  religion?: string;
  denomination?: string;
  cuisine?: string;
  wheelchair?: string;
  fee?: string;
  heritage?: string;
  brand?: string;
  website?: string;
  /** Raw OSM `opening_hours`. Never shown to travellers as-is. */
  openingHours?: string;
  hasWikipedia?: boolean;
  hasWikidata?: boolean;
  /** Length of the English Wikipedia article in bytes: a sourced sign of how much there is to say about a place. */
  articleLength?: number;
  /** Straight-line distance from the destination's centre, in km. */
  distanceKm?: number;
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
  /** OpenStreetMap `opening_hours`. Humanised before display — never inferred. */
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
  /** One line saying what the place is. Written by code from its facts for drafted places. */
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
  /** Map facts for drafted places. Absent on hand-seeded records. */
  facts?: PlaceFacts;
  /** True only when the map shows people book or pay to visit (attraction, museum, fee, heritage). */
  bookable?: boolean;
  /** A regional "usually open" rule from hours-defaults, used only when the map lists no hours. */
  hoursRule?: string;
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

export const MOBILITY = [
  { id: "none", label: "No limits" },
  { id: "limited", label: "Limited walking" },
  { id: "wheelchair", label: "Wheelchair" },
  { id: "pram", label: "Pram or stroller" },
] as const;

export type Mobility = (typeof MOBILITY)[number]["id"];

export type BudgetBasis = "total" | "per_day";

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
  /** For the whole group, per day, derived from `budget` in one place (intent/budget.ts). */
  budgetPerDay: number;
  budgetCurrency: string;
  /** What the traveller actually said: an amount, and whether it's for the trip or per day, per person. */
  budget?: { amount: number; currency: string; basis: BudgetBasis; perPerson: boolean };
  /** The original sentence. Richer signal than any checkbox, so it is never silently dropped. */
  notes: string;
  /** Learned from this traveller's own edits on this device. Optional: a first trip has none. */
  taste?: TasteProfile;
  /** Multi-city route, in order. Present only for two or more cities; `destination` then reads "A → B". */
  legs?: { destination: string; days: number }[];
  /** Getting around. Anything but "none" keeps days short and walking low. */
  mobility?: Mobility;
  adults?: number;
  children?: number;
};

export type ItineraryItem = {
  itemId: string;
  place: Recommendation;
  /** Minutes from midnight. Owned by the scheduler, rewritten on every edit. */
  startMinutes: number;
  durationMinutes: number;
  /** Set when the place could not be given its preferred window. */
  offPreferredWindow?: boolean;
  /** Set when the place's known or usual hours leave no open slot at this point in the day. */
  closedWarning?: boolean;
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
  /** The "don't miss" places for this trip: never removed by "More local" or "Slow it down". */
  anchors?: { id: string; name: string }[];
};
