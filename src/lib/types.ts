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
 * Coarse bands rather than exact prices. We have no live pricing source, and inventing
 * "₹30" on a card would be exactly the fabrication the evidence field exists to prevent.
 * `approxInr` is a per-person planning estimate, surfaced as an estimate in the UI.
 */
export const PRICE_BANDS = {
  free: { label: "Free", approxInr: 0 },
  low: { label: "₹", approxInr: 120 },
  mid: { label: "₹₹", approxInr: 400 },
  high: { label: "₹₹₹", approxInr: 1000 },
} as const;

export type PriceBand = keyof typeof PRICE_BANDS;

export type Coords = { lat: number; lng: number };

export type Recommendation = {
  id: string;
  name: string;
  destination: string;
  tag: LocalityTag;
  category: Category;
  priceBand: PriceBand;
  /** Typical time on site, in minutes — drives scheduling and the "slow it down" transform. */
  durationMinutes: number;
  coords?: Coords;
  photo?: Photo;
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
  budgetPerDayInr: number;
  /** Free text. Richer signal than any checkbox, so it is never silently dropped. */
  notes: string;
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

