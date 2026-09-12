export const INTERESTS = [
  { id: "food", label: "Food" },
  { id: "spiritual", label: "Spiritual" },
  { id: "history", label: "History" },
  { id: "nature", label: "Nature" },
  { id: "local_life", label: "Local Life" },
] as const;

export type Interest = (typeof INTERESTS)[number]["id"];

export const TIME_BUCKETS = [
  { id: "3h", label: "3 hours", days: 1, stopsPerDay: 2 },
  { id: "half_day", label: "Half a day", days: 1, stopsPerDay: 3 },
  { id: "full_day", label: "A full day", days: 1, stopsPerDay: 5 },
  { id: "multi_day", label: "2–3 days", days: 3, stopsPerDay: 3 },
] as const;

export type TimeBucket = (typeof TIME_BUCKETS)[number]["id"];

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

export type Recommendation = {
  id: string;
  name: string;
  destination: string;
  tag: LocalityTag;
  interests: Interest[];
  /** Local clock times, "HH:MM", used to order stops and avoid double-booking a slot. */
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

export type ItineraryRequest = {
  destination: string;
  timeBucket: TimeBucket;
  interests: Interest[];
  dial: DialPosition;
};

export type ItineraryStop = Recommendation & {
  day: number;
  whyItFitsLine: string;
  skip: boolean;
};

export type Itinerary = {
  destination: string;
  timeBucket: TimeBucket;
  dial: DialPosition;
  interests: Interest[];
  stops: ItineraryStop[];
  /** Plain-language shortfalls, shown to the user instead of padding the list. */
  notes: string[];
};
