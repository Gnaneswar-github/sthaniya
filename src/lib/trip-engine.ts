import { formatMoney } from "./currency/format";
import { distanceKm } from "./geo";
import { allowedInterests, everydayUse, fameOf } from "./grounding";
import { hoursDefaultById } from "./hours-defaults";
import { nextOpenStart, parseOpeningHours, type ParsedHours } from "./opening-hours";
import {
  INTERESTS,
  LOCALITY_TAGS,
  PACES,
  PRICE_BANDS,
  type Category,
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
/** Days are capped here when someone can't walk far, uses a wheelchair or pushes a pram. */
const MOBILITY_STOPS_PER_DAY = 3;
/** Beyond this, a leg between stops is worth a ride for anyone with limited mobility. */
export const WALKING_LIMIT_KM = 1;
const MAX_LOCAL_SWAPS = 4;

function minutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

const weekdayOf = (isoDate: string) => new Date(`${isoDate}T12:00:00Z`).getUTCDay();

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

const listOf = (names: string[]) => (names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`);

/* ---------------------------------------------------------------- hours */

const hoursCache = new Map<string, ParsedHours | null>();
function readHours(raw: string): ParsedHours | null {
  if (!hoursCache.has(raw)) hoursCache.set(raw, parseOpeningHours(raw));
  return hoursCache.get(raw)!;
}

/** The place's own listed hours, or its regional "usually open" rule when the map lists none. */
export function hoursFor(place: Recommendation): ParsedHours | null {
  if (place.openingHours) return readHours(place.openingHours);
  const rule = hoursDefaultById(place.hoursRule);
  return rule ? readHours(rule.hours) : null;
}

/* ---------------------------------------------------------------- scoring */

function dialAffinity(tag: LocalityTag, dial: DialPosition): number {
  const table: Record<DialPosition, Record<LocalityTag, number>> = {
    tourist: { tourist_essential: 2, local_favourite: 1, hidden_gem: 0, small_local: 0 },
    local: { tourist_essential: 1, local_favourite: 2, hidden_gem: 1, small_local: 1 },
    insider: { tourist_essential: 0, local_favourite: 1, hidden_gem: 2, small_local: 2 },
  };
  return table[dial][tag];
}

export function excludedTag(dial: DialPosition): LocalityTag | null {
  if (dial === "tourist") return "hidden_gem";
  if (dial === "insider") return "tourist_essential";
  return null;
}

/** Learned taste nudges ranking but never outweighs what the traveller asked for this time. */
function tasteBoost(place: Recommendation, prefs: TripPrefs): number {
  const taste = prefs.taste;
  if (!taste) return 0;
  const liked = Math.min(taste.likes[place.category] ?? 0, 3);
  const disliked = Math.min(taste.dislikes[place.category] ?? 0, 3);
  return liked * 15 - disliked * 30;
}

/** With limited mobility, a listed step-free place rises and a far-flung one sinks. */
function accessBoost(place: Recommendation, prefs: TripPrefs): number {
  if (!prefs.mobility || prefs.mobility === "none") return 0;
  const wheelchair = place.facts?.wheelchair;
  let boost = wheelchair === "yes" ? 25 : wheelchair === "limited" ? 15 : wheelchair === "no" ? -40 : 0;
  if ((place.facts?.distanceKm ?? 0) > 3) boost -= 20;
  return boost;
}

/** The interests a place can honestly count for. Hand-seeded records keep whatever they list. */
function fairInterests(place: Recommendation) {
  if (!place.facts) return place.interests;
  const allowed = allowedInterests(place.category, place.facts);
  return place.interests.filter((i) => allowed.includes(i));
}

/** How well a place answers what the traveller asked for — independent of how local it is. */
function fitScore(place: Recommendation, prefs: TripPrefs): number {
  const hits = fairInterests(place).filter((i) => prefs.interests.includes(i)).length;
  return hits * 100 + tasteBoost(place, prefs) + accessBoost(place, prefs);
}

function score(place: Recommendation, prefs: TripPrefs): number {
  return fitScore(place, prefs) + dialAffinity(place.tag, prefs.dial) * 20 + (10 - place.priority);
}

/** Editorial scores for hand-seeded places, which have no map facts to compute from. */
const SEEDED_SCORE_BY_TAG: Record<LocalityTag, number> = {
  hidden_gem: 92,
  small_local: 80,
  local_favourite: 74,
  tourist_essential: 38,
};

export type ScorePart = { label: string; points: number };

const LOCAL_CUISINE_EXCLUDED = /\b(?:pizza|burger|american|international|fast_food|italian|chinese|mexican|sandwich|chicken|coffee_shop)\b/i;

/**
 * A transparent local score: points for being an everyday place, for not being a visitor
 * landmark, for being independent, for being away from the centre and for local food. Each part
 * is shown on tap ("Why 74?"). Endorsements from residents will be the strongest signal once
 * they exist (HANDOFF P2-11).
 */
export function localScoreBreakdown(place: Recommendation): { score: number; parts: ScorePart[] } {
  const facts = place.facts;
  if (!facts) {
    const points = SEEDED_SCORE_BY_TAG[place.tag];
    return { score: points, parts: [{ label: `${LOCALITY_TAGS[place.tag]}, from our own checked list`, points }] };
  }

  const fame = fameOf(facts);
  const everyday = everydayUse(place.category, facts);
  const eats = place.category === "cafe" || place.category === "food";
  const localFood = eats && facts.cuisine && !LOCAL_CUISINE_EXCLUDED.test(facts.cuisine) ? 10 : 0;
  const parts: ScorePart[] = [
    { label: "An everyday place people use", points: Math.round(40 * everyday) },
    { label: fame > 0 ? "Less of a visitor landmark" : "Not a visitor landmark", points: Math.round(30 * (1 - fame)) },
    { label: facts.brand ? "Part of a chain" : "Independent, not a chain", points: facts.brand ? 0 : 10 },
    { label: "Away from the centre", points: Math.round(10 * Math.min(1, (facts.distanceKm ?? 0) / 4)) },
    { label: eats ? "Local food listed" : "Listed for its own community", points: eats ? localFood : place.category === "temple" || place.category === "church" || place.category === "mosque" || place.category === "worship" ? 10 : 0 },
  ];
  return { score: Math.max(0, Math.min(100, parts.reduce((sum, part) => sum + part.points, 0))), parts };
}

export function placeLocalScore(place: Recommendation): number {
  return localScoreBreakdown(place).score;
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

/** Straight-line km between two stops, when both are on the map. */
export function hopKm(from: Recommendation, to: Recommendation): number | null {
  return from.coords && to.coords ? distanceKm(from.coords, to.coords) : null;
}

/* --------------------------------------------------------------- anchors */

/**
 * The one or two places most visitors would regret skipping — highest fame × fit. At Tourist and
 * Local they are always kept; "More local" and "Slow it down" never remove them.
 */
export function chooseAnchors(pool: Recommendation[], prefs: TripPrefs): Recommendation[] {
  return pool
    .filter((place) => place.facts && fameOf(place.facts) >= 0.45)
    .map((place) => {
      const hits = fairInterests(place).filter((i) => prefs.interests.includes(i)).length;
      return { place, weight: fameOf(place.facts!) * (hits + (prefs.interests.length === 0 ? 1 : 0.25)) };
    })
    .filter(({ weight }) => weight >= 0.4)
    .sort((a, b) => b.weight - a.weight || a.place.priority - b.place.priority)
    .slice(0, 2)
    .map(({ place }) => place);
}

const isAnchor = (trip: Trip, place: Recommendation) => Boolean(trip.anchors?.some((anchor) => anchor.id === place.id));

/** Small shrines and the like count separately from major places, so two a day is the cap. */
const subType = (place: Recommendation) => `${place.category}:${place.tag === "small_local" ? "small" : "main"}`;

/* ------------------------------------------------------------- scheduling */

/** When a place can first fit in the day at or after its preferred window, given its hours. */
function sortKey(place: Recommendation, date: string): number {
  const preferred = minutes(place.timeWindow.start);
  const hours = hoursFor(place);
  if (!hours) return preferred;
  const weekday = weekdayOf(date);
  return nextOpenStart(hours, weekday, preferred, place.durationMinutes) ?? nextOpenStart(hours, weekday, EARLIEST_START, place.durationMinutes) ?? preferred;
}

/** Earliest feasible time first: temples in the morning and late afternoon, meals in the gap. */
function orderForDay(items: ItineraryItem[], date: string): ItineraryItem[] {
  return [...items].sort((a, b) => sortKey(a.place, date) - sortKey(b.place, date));
}

function insertByWindow(items: ItineraryItem[], item: ItineraryItem): ItineraryItem[] {
  const at = items.findIndex((i) => minutes(i.place.timeWindow.start) > minutes(item.place.timeWindow.start));
  return at === -1 ? [...items, item] : [...items.slice(0, at), item, ...items.slice(at)];
}

/**
 * Lays a day out in clock time in the order given, honouring each place's preferred window
 * where it can. It never reorders: once a traveller drags a stop, that order is theirs. When a
 * place's hours (listed, or usual for the region) say it's closed, the visit waits for it to open.
 */
export function scheduleDay(items: ItineraryItem[], date?: string): ItineraryItem[] {
  let cursor = EARLIEST_START;
  return items.map((item) => {
    const preferred = minutes(item.place.timeWindow.start);
    const windowEnd = minutes(item.place.timeWindow.end);
    let start = Math.max(cursor, preferred);
    let movedForHours = false;
    let closedWarning = false;

    const hours = date ? hoursFor(item.place) : null;
    if (hours && date) {
      const open = nextOpenStart(hours, weekdayOf(date), start, item.place.durationMinutes);
      if (open === null) closedWarning = true;
      else {
        movedForHours = open !== start;
        start = open;
      }
    }
    cursor = start + item.place.durationMinutes + TRAVEL_BUFFER_MINUTES;

    const scheduled: ItineraryItem = {
      ...item,
      startMinutes: start,
      durationMinutes: item.place.durationMinutes,
      offPreferredWindow: !movedForHours && start > windowEnd,
    };
    if (closedWarning) scheduled.closedWarning = true;
    else delete scheduled.closedWarning;
    return scheduled;
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

/** Stops per day for this pace, capped at three when getting around is limited. */
export function perDayLimit(prefs: Pick<TripPrefs, "pace" | "mobility">): number {
  const byPace = PACES.find((p) => p.id === prefs.pace)?.itemsPerDay ?? 5;
  return prefs.mobility && prefs.mobility !== "none" ? Math.min(byPace, MOBILITY_STOPS_PER_DAY) : byPace;
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
 * Fills the days in three passes: the anchors first, then one place per stated interest per day,
 * then the best of the rest. Days are filled evenly, repeats of a category are avoided where
 * possible, and no day gets more than two places of the same kind unless that's all they asked for.
 */
function assignToDays(ranked: Recommendation[], dates: string[], perDay: number, prefs: TripPrefs, anchors: Recommendation[]): TripDay[] {
  const days: TripDay[] = dates.map((date) => ({ date, items: [] }));
  const used = new Set<string>();
  const capVariety = prefs.interests.length !== 1;

  const fits = (day: TripDay, rec: Recommendation, strict: boolean) => {
    if (used.has(rec.id) || day.items.length >= perDay) return false;
    if (capVariety && day.items.filter((item) => subType(item.place) === subType(rec)).length >= 2) return false;
    if (strict) {
      if (day.items.some((item) => overlaps(item.place, rec))) return false;
      if (day.items.some((item) => item.place.category === rec.category)) return false;
    }
    return true;
  };
  const put = (day: TripDay, rec: Recommendation) => {
    day.items.push(toItem(rec));
    used.add(rec.id);
  };
  const roomiest = (rec: Recommendation, strict: boolean) =>
    days.filter((day) => fits(day, rec, strict)).sort((a, b) => a.items.length - b.items.length)[0];

  for (const anchor of anchors) {
    const day = roomiest(anchor, false);
    if (day) put(day, anchor);
  }

  for (const day of days) {
    for (const interest of prefs.interests) {
      if (day.items.some((item) => fairInterests(item.place).includes(interest))) continue;
      const rec = ranked.find((candidate) => fairInterests(candidate).includes(interest) && fits(day, candidate, false));
      if (rec) put(day, rec);
    }
  }

  const target = dates.length * perDay;
  const place = (rec: Recommendation) => {
    if (used.has(rec.id)) return;
    const day = roomiest(rec, true) ?? roomiest(rec, false);
    if (day) put(day, rec);
  };
  ranked.slice(0, target).forEach(place);
  for (const rec of ranked.slice(target)) {
    if (days.every((day) => day.items.length >= perDay)) break;
    place(rec);
  }

  return days.map((day) => ({ ...day, items: scheduleDay(orderForDay(day.items, day.date), day.date) }));
}

/* ------------------------------------------------------------ trip build */

export function buildTrip(pool: Recommendation[], prefs: TripPrefs): Trip {
  const dates = tripDates(prefs);
  const perDay = perDayLimit(prefs);
  const base = { id: `trip-${Date.now().toString(36)}`, prefs, createdAt: new Date().toISOString() };

  if (pool.length === 0) {
    return {
      ...base,
      days: dates.map((date) => ({ date, items: [] })),
      notes: [`Let's find a few more places for ${prefs.destination} — try adding an interest or a nearby area.`],
    };
  }

  const dropped = excludedTag(prefs.dial);
  const eligible = dropped ? pool.filter((p) => p.tag !== dropped) : pool;
  const ranked = [...eligible].sort((a, b) => score(b, prefs) - score(a, prefs));
  const anchors = chooseAnchors(pool, prefs);
  // At Insider, anchors may go; the trip still lists them as "You're skipping".
  const forced = prefs.dial === "insider" ? [] : anchors.filter((anchor) => eligible.includes(anchor));

  // An interest the map gave us nothing, or too little, for is said plainly — not silently dropped.
  const labelOf = (interest: string) => INTERESTS.find((i) => i.id === interest)?.label.toLowerCase() ?? interest;
  const available = prefs.interests.map((interest) => ({ interest, count: pool.filter((place) => fairInterests(place).includes(interest)).length }));
  const missing = available.filter(({ count }) => count === 0).map(({ interest }) => interest);
  const thin = available.filter(({ count }) => count > 0 && count < dates.length);
  const notes = [
    ...(missing.length > 0
      ? [`We couldn't find any places for ${listOf(missing.map(labelOf))} in ${prefs.destination} on the map this time. Try building again in a minute, or add a place you know.`]
      : []),
    ...thin.map(
      ({ interest, count }) =>
        `Only ${count} ${count === 1 ? "place" : "places"} for ${labelOf(interest)} came up on the map near ${prefs.destination}, so not every day has one. Add one you know from "+ Add a stop".`,
    ),
  ];

  return {
    ...base,
    days: assignToDays(ranked, dates, perDay, prefs, forced),
    notes,
    anchors: anchors.map(({ id, name }) => ({ id, name })),
  };
}

/** "11 stops over 3 days, about 4 hr of getting around." Recomputed after every edit. */
export function tripSummary(trip: Trip): string {
  const stops = trip.days.flatMap((d) => d.items).length;
  const days = trip.days.length;
  return `${stops} ${stops === 1 ? "stop" : "stops"} over ${days} ${days === 1 ? "day" : "days"}, about ${durationLabel(tripTravelMinutes(trip))} of getting around.`;
}

/**
 * Notes derived from the trip as it stands now, so nothing goes stale after an edit. Notes stored
 * on the trip (a city left open on a route, say) are kept; old summary lines are not.
 */
export function tripNotes(trip: Trip): string[] {
  const notes = trip.notes.filter((note) => !/fit this trip beautifully/i.test(note));
  const items = trip.days.flatMap((day) => day.items);

  if (trip.prefs.mobility && trip.prefs.mobility !== "none") {
    notes.unshift("We kept days short and walking low. Check steps and access at each place.");
  }

  const offInterest = items.filter((item) => !fairInterests(item.place).some((i) => trip.prefs.interests.includes(i))).length;
  if (offInterest > 0) {
    notes.push(
      `${offInterest === 1 ? "One stop is" : `${offInterest} stops are`} a little outside your picks, added to round the days out — swap ${offInterest === 1 ? "it" : "them"} anytime.`,
    );
  }

  if (trip.prefs.dial === "insider") {
    const used = usedPlaceIds(trip);
    const skipped = (trip.anchors ?? []).filter((anchor) => !used.has(anchor.id)).map((anchor) => anchor.name);
    if (skipped.length > 0) {
      notes.push(`You're skipping ${listOf(skipped)}, the places most visitors come for. Add ${skipped.length === 1 ? "it" : "them"} back from "+ Add a stop" if you change your mind.`);
    }
  }

  const closed = items.filter((item) => item.closedWarning).map((item) => item.place.name);
  if (closed.length > 0) {
    notes.push(`${listOf(closed)} may be closed at the planned time. Check locally, or move ${closed.length === 1 ? "it" : "them"} to another day.`);
  }

  return notes;
}

/* -------------------------------------------------------------- editing */

function withDays(trip: Trip, days: TripDay[]): Trip {
  return { ...trip, days: days.map((day) => ({ ...day, items: scheduleDay(day.items, day.date) })) };
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
      index === dayIndex ? { ...day, items: insertByWindow(day.items, toItem(place)) } : day,
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
      return index === toDayIndex ? { ...day, items: insertByWindow(without, item) } : { ...day, items: without };
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

/** Puts a stop at an exact position in a day — what drag and drop and "move to day" need. */
export function placeItem(trip: Trip, itemId: string, toDayIndex: number, toIndex: number): Trip {
  const item = trip.days.flatMap((d) => d.items).find((i) => i.itemId === itemId);
  if (!item || toDayIndex < 0 || toDayIndex >= trip.days.length) return trip;

  return withDays(
    trip,
    trip.days.map((day, index) => {
      const without = day.items.filter((i) => i.itemId !== itemId);
      if (index !== toDayIndex) return { ...day, items: without };
      const at = Math.max(0, Math.min(toIndex, without.length));
      return { ...day, items: [...without.slice(0, at), item, ...without.slice(at)] };
    }),
  );
}

/** Nudges a stop one place earlier or later within its own day. */
export function shiftItem(trip: Trip, itemId: string, direction: -1 | 1): Trip {
  const dayIndex = trip.days.findIndex((d) => d.items.some((i) => i.itemId === itemId));
  if (dayIndex === -1) return trip;
  const index = trip.days[dayIndex].items.findIndex((i) => i.itemId === itemId);
  return placeItem(trip, itemId, dayIndex, index + direction);
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

/** Interests that only this stop covers on its day, which a replacement or removal must respect. */
function onlyCoveredBy(day: TripDay, item: ItineraryItem, prefs: TripPrefs) {
  const others = day.items.filter((other) => other.itemId !== item.itemId);
  return prefs.interests.filter(
    (interest) => fairInterests(item.place).includes(interest) && !others.some((other) => fairInterests(other.place).includes(interest)),
  );
}

/**
 * Swaps the least local stops for everyday local places — never an anchor, and never in a way
 * that loses an interest from a day or stacks up more than two small places of the same kind.
 */
export function makeMoreLocal(trip: Trip, pool: Recommendation[]): TransformResult {
  let next = trip;
  let swaps = 0;
  const dropped = excludedTag(trip.prefs.dial);
  const capVariety = trip.prefs.interests.length !== 1;

  const order = trip.days
    .flatMap((day) => day.items)
    .filter((item) => !isAnchor(trip, item.place))
    .sort((a, b) => placeLocalScore(a.place) - placeLocalScore(b.place));

  for (const item of order) {
    if (swaps >= MAX_LOCAL_SWAPS) break;
    const current = placeLocalScore(item.place);
    if (current >= 70) break;

    const day = next.days.find((d) => d.items.some((i) => i.itemId === item.itemId));
    if (!day) continue;
    const others = day.items.filter((other) => other.itemId !== item.itemId);
    const needed = onlyCoveredBy(day, item, trip.prefs);
    const used = usedPlaceIds(next);

    const better = pool
      .filter(
        (p) =>
          !used.has(p.id) &&
          p.destination === item.place.destination &&
          p.tag !== dropped &&
          placeLocalScore(p) >= current + 10 &&
          needed.every((interest) => fairInterests(p).includes(interest)) &&
          (!capVariety || others.filter((other) => subType(other.place) === subType(p)).length < 2),
      )
      .sort((a, b) => fitScore(b, trip.prefs) + placeLocalScore(b) - (fitScore(a, trip.prefs) + placeLocalScore(a)))[0];

    if (better) {
      next = replaceItem(next, item.itemId, better);
      swaps += 1;
    }
  }

  const stillIn = usedPlaceIds(next);
  const kept = (trip.anchors ?? []).filter((anchor) => stillIn.has(anchor.id)).map((anchor) => anchor.name);
  const keptLine = kept.length > 0 ? ` Kept ${listOf(kept)} — worth it for any visitor.` : "";

  return {
    trip: next,
    summary:
      swaps === 0
        ? `This trip is already about as local as the places we found for ${trip.prefs.destination} go.${keptLine}`
        : `Swapped ${swaps} ${swaps === 1 ? "stop" : "stops"} for everyday local places.${keptLine}`,
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

/**
 * Drops the stop that fits the traveller least from each full day — never an anchor, never the
 * only stop for one of their interests — and, between equally weak stops, the one whose removal
 * leaves the trip's local balance where it was.
 */
export function slowDown(trip: Trip): TransformResult {
  let removed = 0;
  let remaining = trip.days.flatMap((day) => day.items);
  const average = (items: ItineraryItem[]) => (items.length ? items.reduce((sum, i) => sum + placeLocalScore(i.place), 0) / items.length : 0);

  const days = trip.days.map((day) => {
    if (day.items.length <= 2) return day;
    const removable = day.items.filter((item) => !isAnchor(trip, item.place));
    const preferred = removable.filter((item) => onlyCoveredBy(day, item, trip.prefs).length === 0);
    const choices = preferred.length > 0 ? preferred : removable;
    if (choices.length === 0) return day;

    const lowest = Math.min(...choices.map((item) => fitScore(item.place, trip.prefs)));
    const before = average(remaining);
    const weakest = choices
      .filter((item) => fitScore(item.place, trip.prefs) - lowest < 50)
      .map((item) => ({ item, drift: Math.abs(average(remaining.filter((r) => r.itemId !== item.itemId)) - before) }))
      .sort((a, b) => a.drift - b.drift)[0].item;

    remaining = remaining.filter((item) => item.itemId !== weakest.itemId);
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

/** "More like this": adds the best unused place of the same kind right after the one they liked. */
export function addSimilar(trip: Trip, pool: Recommendation[], itemId: string): TransformResult {
  const dayIndex = trip.days.findIndex((d) => d.items.some((i) => i.itemId === itemId));
  if (dayIndex === -1) return { trip, summary: "" };

  const items = trip.days[dayIndex].items;
  const index = items.findIndex((i) => i.itemId === itemId);
  const liked = items[index].place;
  const used = usedPlaceIds(trip);

  const similar = pool
    .filter((p) => !used.has(p.id) && (p.category === liked.category || p.interests.some((i) => liked.interests.includes(i))))
    .sort(
      (a, b) =>
        Number(b.category === liked.category) - Number(a.category === liked.category) ||
        score(b, trip.prefs) - score(a, trip.prefs),
    )[0];

  if (!similar) {
    return { trip, summary: `You already have every place like ${liked.name} that we found — we'll remember you like these.` };
  }

  const next = withDays(
    trip,
    trip.days.map((day, i) =>
      i === dayIndex ? { ...day, items: [...items.slice(0, index + 1), toItem(similar), ...items.slice(index + 1)] } : day,
    ),
  );
  return { trip: next, summary: `Added ${similar.name}, right after ${liked.name}.` };
}

export const INDOOR_CATEGORIES: Category[] = ["museum", "cafe", "market", "temple", "church", "mosque", "worship", "food"];

/** On rainy days, trades outdoor stops for the best unused indoor ones. Nothing else moves. */
export function rainyDaySwap(trip: Trip, pool: Recommendation[], rainyDates: string[]): TransformResult {
  const rainy = new Set(rainyDates);
  let next = trip;
  let swaps = 0;

  for (const day of trip.days) {
    if (!rainy.has(day.date)) continue;
    for (const item of day.items) {
      if (item.place.category !== "outdoors") continue;
      const used = usedPlaceIds(next);
      const indoor = pool
        .filter((p) => !used.has(p.id) && INDOOR_CATEGORIES.includes(p.category))
        .sort((a, b) => score(b, trip.prefs) - score(a, trip.prefs))[0];
      if (indoor) {
        next = replaceItem(next, item.itemId, indoor);
        swaps += 1;
      }
    }
  }

  return {
    trip: next,
    summary:
      swaps === 0
        ? "Your rainy days are already as indoor as the places we found allow."
        : `Swapped ${swaps} outdoor ${swaps === 1 ? "stop" : "stops"} for indoor ones on the rainy ${rainy.size === 1 ? "day" : "days"}.`,
  };
}

const OFF_INTEREST_LINE: Record<DialPosition, string> = {
  tourist: "Placed where it fits your day best.",
  local: "A little outside your list, and it rounds the day out.",
  insider: "A small local stop that rounds the day out.",
};

/**
 * Only ever claims a fit the traveller actually asked for, and only one the place can honestly
 * serve: a restaurant is never "picked for the spiritual". A place that matches nothing they asked
 * for says so plainly.
 */
export function whyItFitsLine(place: Recommendation, prefs: TripPrefs, interestLabel: (i: string) => string): string {
  const honest = fairInterests(place);
  for (const interest of prefs.interests) {
    const line = place.whyItFits[interest];
    if (line && honest.includes(interest)) return line;
  }

  const matched = prefs.interests.find((i) => honest.includes(i));
  if (matched) return `Picked for the ${interestLabel(matched).toLowerCase()} you asked for.`;

  if (place.category === "cafe") return "A nearby coffee stop between your other plans.";
  if (place.category === "food") return "A nearby food stop between your other plans.";
  return OFF_INTEREST_LINE[prefs.dial];
}
