import {
  SUPPORTED_CITIES,
  TIME_BUCKETS,
  type DialPosition,
  type Interest,
  type Itinerary,
  type ItineraryRequest,
  type ItineraryStop,
  type LocalityTag,
  type Recommendation,
} from "./types";

/**
 * The dial is enforced here as a hard filter, never left to inference (PRD §4).
 * Tourist drops hidden gems; Insider drops tourist essentials; Local allows everything.
 */
function excludedTag(dial: DialPosition): LocalityTag | null {
  if (dial === "tourist") return "hidden_gem";
  if (dial === "insider") return "tourist_essential";
  return null;
}

/** Each end of the dial must also *contain* at least two of its signature tag. */
function requiredTag(dial: DialPosition): { tag: LocalityTag; count: number } | null {
  if (dial === "tourist") return { tag: "tourist_essential", count: 2 };
  if (dial === "insider") return { tag: "hidden_gem", count: 2 };
  return null;
}

function affinity(tag: LocalityTag, dial: DialPosition): number {
  const table: Record<DialPosition, Record<LocalityTag, number>> = {
    tourist: { tourist_essential: 2, local_favourite: 1, hidden_gem: 0 },
    local: { tourist_essential: 1, local_favourite: 2, hidden_gem: 1 },
    insider: { tourist_essential: 0, local_favourite: 1, hidden_gem: 2 },
  };
  return table[dial][tag];
}

function minutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function overlaps(a: Recommendation, b: Recommendation): boolean {
  return (
    minutes(a.timeWindow.start) < minutes(b.timeWindow.end) &&
    minutes(b.timeWindow.start) < minutes(a.timeWindow.end)
  );
}

function score(rec: Recommendation, req: ItineraryRequest): number {
  const interestHits = rec.interests.filter((i) => req.interests.includes(i)).length;
  return interestHits * 100 + affinity(rec.tag, req.dial) * 20 + (10 - rec.priority);
}

const OFF_INTEREST_LINE: Record<DialPosition, string> = {
  tourist: "Not something you picked — it's here because most people regret skipping it.",
  local: "Outside what you asked for, but the day reads better with it in.",
  insider: "Not one of your interests — it's here because you'd only ever hear about it from someone who lives here.",
};

/**
 * Only ever claims a fit the user actually asked for. A stop that matches none of their
 * interests says so, rather than borrowing an unrelated line (PRD §6).
 */
function whyItFitsLine(rec: Recommendation, interests: Interest[], dial: DialPosition): string {
  for (const interest of interests) {
    const line = rec.whyItFits[interest];
    if (line) return line;
  }
  return OFF_INTEREST_LINE[dial];
}

type Placed = { rec: Recommendation; day: number };

/** First day whose stops neither collide in time nor exceed the per-day count. */
function findDay(rec: Recommendation, placed: Placed[], days: number, perDay: number): number | null {
  for (let day = 1; day <= days; day++) {
    const onDay = placed.filter((p) => p.day === day);
    if (onDay.length >= perDay) continue;
    if (onDay.some((p) => overlaps(p.rec, rec))) continue;
    return day;
  }
  return null;
}

export function buildItinerary(pool: Recommendation[], req: ItineraryRequest): Itinerary {
  const bucket = TIME_BUCKETS.find((b) => b.id === req.timeBucket) ?? TIME_BUCKETS[1];
  const notes: string[] = [];
  const base = { destination: req.destination, timeBucket: req.timeBucket, dial: req.dial, interests: req.interests };

  if (pool.length === 0) {
    const known = SUPPORTED_CITIES.join(", ");
    return {
      ...base,
      stops: [],
      notes: [
        `We haven't mapped ${req.destination} yet — a city only goes live here once someone has checked every recommendation by hand. So far that's ${known}.`,
      ],
    };
  }

  const dropped = excludedTag(req.dial);
  const eligible = dropped ? pool.filter((r) => r.tag !== dropped) : pool;
  const ranked = [...eligible].sort((a, b) => score(b, req) - score(a, req));

  const target = bucket.days * bucket.stopsPerDay;
  const placed: Placed[] = [];
  for (const rec of ranked) {
    if (placed.length >= target) break;
    const day = findDay(rec, placed, bucket.days, bucket.stopsPerDay);
    if (day !== null) placed.push({ rec, day });
  }

  const required = requiredTag(req.dial);
  if (required) {
    const inPool = eligible.filter((r) => r.tag === required.tag);
    const quota = Math.min(required.count, inPool.length, target);
    let held = placed.filter((p) => p.rec.tag === required.tag).length;

    const waiting = ranked.filter((r) => r.tag === required.tag && !placed.some((p) => p.rec.id === r.id));
    while (held < quota && waiting.length > 0) {
      const candidate = waiting.shift()!;
      const weakestIndex = placed.reduce<number>((weakest, p, i) => {
        if (p.rec.tag === required.tag) return weakest;
        if (weakest === -1) return i;
        return score(p.rec, req) < score(placed[weakest].rec, req) ? i : weakest;
      }, -1);
      if (weakestIndex === -1) break;

      const [removed] = placed.splice(weakestIndex, 1);
      const day = findDay(candidate, placed, bucket.days, bucket.stopsPerDay);
      if (day === null) {
        placed.splice(weakestIndex, 0, removed);
        continue;
      }
      placed.push({ rec: candidate, day });
      held += 1;
    }

    if (inPool.length < required.count) {
      const label = required.tag === "hidden_gem" ? "hidden gems" : "must-see spots";
      notes.push(
        `Only ${inPool.length} ${label} in our verified set for ${req.destination} match this — the rest of the list leans on the next closest thing.`,
      );
    }
  }

  // Shortfalls are stated plainly rather than quietly padded over (PRD §8).
  const offInterest = placed.filter(
    (p) => !p.rec.interests.some((i) => req.interests.includes(i)),
  ).length;
  if (offInterest > 0) {
    notes.push(
      `Fewer ${req.dial === "insider" ? "insider" : "matching"} picks for this combination in ${req.destination} than we'd like — ${offInterest === 1 ? "one stop below sits" : `${offInterest} stops below sit`} outside what you asked for, and we've flagged that on the card rather than pretending otherwise.`,
    );
  }
  if (placed.length < target) {
    notes.push(
      `We could honestly fill only ${placed.length} of ${target} stops here — the rest of the time is yours to wander with.`,
    );
  }

  placed.sort((a, b) => a.day - b.day || minutes(a.rec.timeWindow.start) - minutes(b.rec.timeWindow.start));

  // The skip flag belongs on one genuinely lower-priority stop, never on a stop the dial required.
  let skipId: string | null = null;
  if (placed.length >= 3) {
    const droppable = placed.filter((p) => !required || p.rec.tag !== required.tag);
    const weakest = droppable.sort((a, b) => score(a.rec, req) - score(b.rec, req))[0];
    skipId = weakest?.rec.id ?? null;
  }

  const stops: ItineraryStop[] = placed.map((p) => ({
    ...p.rec,
    day: p.day,
    whyItFitsLine: whyItFitsLine(p.rec, req.interests, req.dial),
    skip: p.rec.id === skipId,
  }));

  return { ...base, stops, notes };
}
