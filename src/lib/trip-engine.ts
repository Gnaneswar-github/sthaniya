import { formatMoney } from "./currency/format";
import {
  PACES,
  PRICE_BANDS,
  type DialPosition,
  type ItineraryItem,
  type LocalityTag,
  type Recommendation,
  type Trip,
  type TripDay,
  type TripPrefs,
} from "./types";

/**
 * The trip engine is deliberately deterministic. Every transform here — replace, cheaper,
 * more local, slower — is a rule over the place data, not a model call. That keeps edits
 * instant and repeatable, and leaves the language model for the parts that genuinely need
 * judgement (reading free-text preferences, conversational edits) rather than for arithmetic.
 */

/** A flat allowance between stops. Not a routed estimate — we have no routing source. */
const TRAVEL_BUFFER_MINUTES = 30;
const EARLIEST_START = 6 * 60;

function minutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function clockLabel(totalMinutes: number): string {
  const wrapped = ((totalMinutes % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  const suffix = h < 12 ? "AM" : "PM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}

export function durationLabel(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} hr`;
  return `${h} hr ${m} min`;
}

/* ---------------------------------------------------------------- scoring */

function dialAffinity(tag: LocalityTag, dial: DialPosition): number {
  const table: Record<DialPosition, Record<LocalityTag, number>> = {
    tourist: { tourist_essential: 2, local_favourite: 1, hidden_gem: 0 },
    local: { tourist_essential: 1, local_favourite: 2, hidden_gem: 1 },
    insider: { tourist_essential: 0, local_favourite: 1, hidden_gem: 2 },
  };
  return table[dial][tag];
}

export function excludedTag(dial: DialPosition): LocalityTag | null {
  if (dial === "tourist") return "hidden_gem";
  if (dial === "insider") return "tourist_essential";
  return null;
}

function score(place: Recommendation, prefs: TripPrefs): number {
  const hits = place.interests.filter((i) => prefs.interests.includes(i)).length;
  return hits * 100 + dialAffinity(place.tag, prefs.dial) * 20 + (10 - place.priority);
}

/**
 * Derived from our own classification of a place, not from scraped popularity data.
 * The UI says as much — it is an editorial signal, presented as one.
 */
const LOCAL_SCORE_BY_TAG: Record<LocalityTag, number> = {
  hidden_gem: 92,
  local_favourite: 74,
  tourist_essential: 38,
};

export function placeLocalScore(place: Recommendation): number {
  return LOCAL_SCORE_BY_TAG[place.tag];
}

export function tripLocalScore(trip: Trip): number {
  const items = trip.days.flatMap((day) => day.items);
  if (items.length === 0) return 0;
  const total = items.reduce((sum, item) => sum + placeLocalScore(item.place), 0);
  return Math.round(total / items.length);
}

export function placeCost(place: Recommendation): number {
  return PRICE_BANDS[place.priceBand].approx;
}

export function tripCost(trip: Trip): number {
  return trip.days.flatMap((d) => d.items).reduce((sum, item) => sum + placeCost(item.place), 0);
}

/** Whatever the destination's own data is quoted in. Falls back to the trip's own currency. */
export function tripCostCurrency(trip: Trip): string {
  const first = trip.days.flatMap((d) => d.items).find((item) => item.place.costCurrency);
  return first?.place.costCurrency ?? trip.prefs.budgetCurrency;
}

export function tripTravelMinutes(trip: Trip): number {
  return trip.days.reduce((sum, day) => sum + Math.max(0, day.items.length - 1) * TRAVEL_BUFFER_MINUTES, 0);
}

/* ------------------------------------------------------------- scheduling */

/** Lays a day out in clock time, honouring each place's preferred window where it can. */
export function scheduleDay(items: ItineraryItem[]): ItineraryItem[] {
  const ordered = [...items].sort(
    (a, b) => minutes(a.place.timeWindow.start) - minutes(b.place.timeWindow.start),
  );

  let cursor = EARLIEST_START;
  return ordered.map((item) => {
    const preferred = minutes(item.place.timeWindow.start);
    const windowEnd = minutes(item.place.timeWindow.end);
    const start = Math.max(cursor, preferred);
    cursor = start + item.place.durationMinutes + TRAVEL_BUFFER_MINUTES;

    return {
      ...item,
      startMinutes: start,
      durationMinutes: item.place.durationMinutes,
      offPreferredWindow: start > windowEnd,
    };
  });
}

function overlaps(a: Recommendation, b: Recommendation): boolean {
  return (
    minutes(a.timeWindow.start) < minutes(b.timeWindow.end) &&
    minutes(b.timeWindow.start) < minutes(a.timeWindow.end)
  );
}

function dayCount(prefs: TripPrefs): number {
  const start = Date.parse(prefs.startDate);
  const end = Date.parse(prefs.endDate);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return 1;
  return Math.floor((end - start) / 86_400_000) + 1;
}

export function tripDates(prefs: TripPrefs): string[] {
  const total = dayCount(prefs);
  const start = new Date(prefs.startDate);
  return Array.from({ length: total }, (_, i) => {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    return date.toISOString().slice(0, 10);
  });
}

function itemsPerDay(prefs: TripPrefs): number {
  return PACES.find((p) => p.id === prefs.pace)?.itemsPerDay ?? 5;
}

let sequence = 0;
function newItemId(): string {
  sequence += 1;
  return `item-${Date.now().toString(36)}-${sequence}`;
}

function toItem(place: Recommendation): ItineraryItem {
  return {
    itemId: newItemId(),
    place,
    startMinutes: minutes(place.timeWindow.start),
    durationMinutes: place.durationMinutes,
  };
}

/**
 * Places go to the first day with room and no clash. A first pass avoids repeating a
 * category within a day so the traveller doesn't get four temples in a row; a second pass
 * relaxes that rather than dropping the stop.
 */
function assignToDays(places: Recommendation[], dates: string[], perDay: number): TripDay[] {
  const days: TripDay[] = dates.map((date) => ({ date, items: [] }));

  const place = (rec: Recommendation, avoidRepeatCategory: boolean): boolean => {
    for (const day of days) {
      if (day.items.length >= perDay) continue;
      if (day.items.some((item) => overlaps(item.place, rec))) continue;
      if (avoidRepeatCategory && day.items.some((item) => item.place.category === rec.category)) continue;
      day.items.push(toItem(rec));
      return true;
    }
    return false;
  };

  for (const rec of places) {
    if (!place(rec, true)) place(rec, false);
  }

  return days.map((day) => ({ ...day, items: scheduleDay(day.items) }));
}

/* ------------------------------------------------------------ trip build */

export function buildTrip(pool: Recommendation[], prefs: TripPrefs): Trip {
  const dates = tripDates(prefs);
  const perDay = itemsPerDay(prefs);
  const notes: string[] = [];
  const base = { id: `trip-${Date.now().toString(36)}`, prefs, createdAt: new Date().toISOString() };

  if (pool.length === 0) {
    return {
      ...base,
      days: dates.map((date) => ({ date, items: [] })),
      notes: [
        `Let's find a few more places for ${prefs.destination} — try adding an interest or a nearby area.`,
      ],
    };
  }

  const dropped = excludedTag(prefs.dial);
  const eligible = dropped ? pool.filter((p) => p.tag !== dropped) : pool;
  const ranked = [...eligible].sort((a, b) => score(b, prefs) - score(a, prefs));

  const target = dates.length * perDay;
  const days = assignToDays(ranked.slice(0, target), dates, perDay);
  const placed = days.flatMap((d) => d.items);

  const offInterest = placed.filter(
    (item) => !item.place.interests.some((i) => prefs.interests.includes(i)),
  ).length;
  if (offInterest > 0) {
    notes.push(
      `${offInterest === 1 ? "One stop is" : `${offInterest} stops are`} a little outside your picks, added to round the days out — swap ${offInterest === 1 ? "it" : "them"} anytime.`,
    );
  }
  if (placed.length < target) {
    notes.push(
      `${placed.length} stops fit this trip beautifully, which leaves you plenty of open time to wander.`,
    );
  }

  return { ...base, days, notes };
}

/* -------------------------------------------------------------- editing */

function withDays(trip: Trip, days: TripDay[]): Trip {
  return { ...trip, days: days.map((day) => ({ ...day, items: scheduleDay(day.items) })) };
}

export function usedPlaceIds(trip: Trip): Set<string> {
  return new Set(trip.days.flatMap((d) => d.items).map((item) => item.place.id));
}

export function removeItem(trip: Trip, itemId: string): Trip {
  return withDays(
    trip,
    trip.days.map((day) => ({ ...day, items: day.items.filter((item) => item.itemId !== itemId) })),
  );
}

export function addPlace(trip: Trip, place: Recommendation, dayIndex: number): Trip {
  return withDays(
    trip,
    trip.days.map((day, index) =>
      index === dayIndex ? { ...day, items: [...day.items, toItem(place)] } : day,
    ),
  );
}

export function moveItem(trip: Trip, itemId: string, toDayIndex: number): Trip {
  const item = trip.days.flatMap((d) => d.items).find((i) => i.itemId === itemId);
  if (!item) return trip;

  return withDays(
    trip,
    trip.days.map((day, index) => {
      const without = day.items.filter((i) => i.itemId !== itemId);
      return index === toDayIndex ? { ...day, items: [...without, item] } : { ...day, items: without };
    }),
  );
}

export function replaceItem(trip: Trip, itemId: string, replacement: Recommendation): Trip {
  return withDays(
    trip,
    trip.days.map((day) => ({
      ...day,
      items: day.items.map((item) => (item.itemId === itemId ? toItem(replacement) : item)),
    })),
  );
}

/* --------------------------------------------------------- alternatives */

export const REPLACE_REASONS = [
  { id: "touristy", label: "Too touristy" },
  { id: "expensive", label: "Too expensive" },
  { id: "not_interested", label: "Not interested" },
  { id: "visited", label: "Already been" },
  { id: "different", label: "Just show me something else" },
] as const;

export type ReplaceReason = (typeof REPLACE_REASONS)[number]["id"];

export function alternativesFor(
  trip: Trip,
  pool: Recommendation[],
  itemId: string,
  reason: ReplaceReason,
): Recommendation[] {
  const current = trip.days.flatMap((d) => d.items).find((i) => i.itemId === itemId);
  if (!current) return [];

  const used = usedPlaceIds(trip);
  let candidates = pool.filter((p) => !used.has(p.id));

  if (reason === "touristy") {
    candidates = candidates.filter((p) => placeLocalScore(p) > placeLocalScore(current.place));
  }
  if (reason === "expensive") {
    candidates = candidates.filter((p) => placeCost(p) < placeCost(current.place));
  }
  if (reason === "not_interested") {
    candidates = candidates.filter((p) => p.category !== current.place.category);
  }

  return candidates.sort((a, b) => score(b, trip.prefs) - score(a, trip.prefs)).slice(0, 3);
}

/* ---------------------------------------------------------- transforms */

export type TransformResult = { trip: Trip; summary: string };

/** Swaps the least-local stops for more local ones, keeping the day's shape intact. */
export function makeMoreLocal(trip: Trip, pool: Recommendation[]): TransformResult {
  let next = trip;
  let swaps = 0;

  for (const item of trip.days.flatMap((d) => d.items)) {
    if (placeLocalScore(item.place) >= LOCAL_SCORE_BY_TAG.local_favourite) continue;

    const used = usedPlaceIds(next);
    const better = pool
      .filter((p) => !used.has(p.id) && placeLocalScore(p) > placeLocalScore(item.place))
      .sort((a, b) => score(b, trip.prefs) - score(a, trip.prefs))[0];

    if (better) {
      next = replaceItem(next, item.itemId, better);
      swaps += 1;
    }
  }

  return {
    trip: next,
    summary:
      swaps === 0
        ? `This trip is already about as local as the places we have for ${trip.prefs.destination} go.`
        : `Swapped ${swaps} ${swaps === 1 ? "stop" : "stops"} for places with less tourist traffic.`,
  };
}

export function makeCheaper(trip: Trip, pool: Recommendation[]): TransformResult {
  const before = tripCost(trip);
  let next = trip;

  for (const item of trip.days.flatMap((d) => d.items)) {
    if (placeCost(item.place) === 0) continue;

    const used = usedPlaceIds(next);
    const cheaper = pool
      .filter((p) => !used.has(p.id) && placeCost(p) < placeCost(item.place))
      .sort((a, b) => score(b, trip.prefs) - score(a, trip.prefs))[0];

    if (cheaper) next = replaceItem(next, item.itemId, cheaper);
  }

  const saved = before - tripCost(next);
  const currency = tripCostCurrency(next);
  // "Unknown" costs zero in the arithmetic, so a drafted trip used to be told it was
  // "already free to walk into" — a claim about prices nobody has checked.
  const priced = next.days.flatMap((d) => d.items).some((item) => item.place.priceBand !== "unknown");
  return {
    trip: next,
    summary: !priced
      ? "These stops don't list prices, so there's nothing to trim."
      : saved <= 0
        ? "Nothing here is costing you much — the priced stops are already the cheapest we have."
        : `Trimmed roughly ${formatMoney({ amount: saved, currency })} by swapping paid stops for free ones.`,
  };
}

/** Drops the weakest stop from each day rather than compressing everything. */
export function slowDown(trip: Trip): TransformResult {
  let removed = 0;
  const days = trip.days.map((day) => {
    if (day.items.length <= 2) return day;
    const weakest = [...day.items].sort(
      (a, b) => score(a.place, trip.prefs) - score(b.place, trip.prefs),
    )[0];
    removed += 1;
    return { ...day, items: day.items.filter((item) => item.itemId !== weakest.itemId) };
  });

  return {
    trip: withDays(trip, days),
    summary:
      removed === 0
        ? "These days are already light — there's nothing worth cutting."
        : `Removed ${removed} ${removed === 1 ? "stop" : "stops"}, leaving more time at the ones that matter.`,
  };
}

const OFF_INTEREST_LINE: Record<DialPosition, string> = {
  tourist: "A classic, placed where it fits your day best.",
  local: "A little outside your list, and it rounds the day out nicely.",
  insider: "A quieter local spot that rounds the day out.",
};

/**
 * Only ever claims a fit the traveller actually asked for. Note the middle case: a place can
 * match a chosen interest without having a hand-written line for it, and saying "not something
 * you picked" there would be plainly wrong.
 */
export function whyItFitsLine(place: Recommendation, prefs: TripPrefs, interestLabel: (i: string) => string): string {
  for (const interest of prefs.interests) {
    const line = place.whyItFits[interest];
    if (line) return line;
  }

  const matched = prefs.interests.find((i) => place.interests.includes(i));
  if (matched) return `Picked for the ${interestLabel(matched).toLowerCase()} you asked for.`;

  return OFF_INTEREST_LINE[prefs.dial];
}
