import { DESTINATIONS } from "./destinations/curation";
import { readBudget, type BudgetReading } from "./intent/budget";
import { parseWhen, type Clock, type DateReading } from "./intent/dates";
import { readMobility, readParty, typeFromParty, type MobilityReading, type PartyReading } from "./intent/party";
import type { DialPosition, Interest, Pace, TravellerType } from "./types";

/**
 * Turns a sentence into structured travel preferences.
 *
 * Deliberately deterministic. A language model would read this better, and there is a clean
 * seam for one (`parseIntent` is pure and returns evidence per field) — but a model call on
 * the critical path costs a second and can fail on stage, and this is a constrained domain
 * where rules get most of the way. Every field carries the exact phrase it was read from, so
 * the interface can show its working and let the traveller correct it rather than guess.
 */

export type Evidence = { value: string; matched: string } | null;

export type ParsedIntent = {
  destination: Evidence;
  durationDays: { value: number; matched: string } | null;
  /** When, from "next month", "this weekend", "12–15 Oct"… Guessed dates are marked. */
  dates: DateReading | null;
  travellerType: { value: TravellerType; matched: string } | null;
  /** Headcount, when the sentence says or implies it. */
  party: PartyReading;
  /** Limited walking, a wheelchair or a pram — anything that should shorten and simplify days. */
  mobility: MobilityReading;
  budget: BudgetReading | null;
  /** Every phrase that triggered each interest, so the interface can show them all. */
  interests: { value: Interest; matched: string[] }[];
  dial: { value: DialPosition; matched: string } | null;
  pace: { value: Pace; matched: string } | null;
  /** Phrases we recognised as dislikes — shown back so nothing looks silently ignored. */
  avoid: string[];
  /** Two or more cities in order, when the sentence describes a route. */
  legs: { destination: string; days: number; matched: string }[] | null;
};

function find(text: string, pattern: RegExp): RegExpMatchArray | null {
  return text.match(pattern);
}

/* ------------------------------------------------------------- destination */

const STOP_AFTER_PLACE = /\b(?:with|for|and|but|we|i|my|our|on|during|in|around|next|this|over|tomorrow|today)\b/i;

/** Capitalised words that start sentences but are never places. */
const NOT_A_PLACE = new Set(
  (
    "a an the my our we i me us it this that next last long weekend week weeks month months day days one two three four five six seven eight nine ten " +
    "january february march april may june july august september october november december monday tuesday wednesday thursday friday saturday sunday " +
    "christmas diwali easter new please hi hello plan trip holiday vacation family friends solo around about budget love avoid just"
  ).split(" "),
);

const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Curated names and the shorter ways people write them: "Oaxaca" for "Oaxaca City", "Penang" for "George Town, Penang". */
const CURATED_VARIANTS = DESTINATIONS.flatMap((destination) =>
  [...new Set([destination.name, destination.name.replace(/\s+City$/i, ""), ...destination.name.split(/,\s*/)])]
    .filter((variant) => variant.length >= 3)
    .map((variant) => ({ canonical: destination.name, pattern: new RegExp(`\\b${escapeRegex(variant)}\\b`, "i"), length: variant.length })),
).sort((a, b) => b.length - a.length);

const firstWord = (phrase: string) => phrase.split(/\s+/)[0].toLowerCase();

function parseDestination(raw: string): Evidence {
  // A curated destination named anywhere in the sentence wins — we know these are real.
  for (const variant of CURATED_VARIANTS) {
    const hit = raw.match(variant.pattern);
    if (hit) return { value: variant.canonical, matched: hit[0] };
  }

  for (const phrase of raw.matchAll(/\b(?:in|to|around|visiting|visit|explore|exploring)\s+(\p{Lu}[\p{L}'’-]*(?:\s+\p{Lu}[\p{L}'’-]*){0,2})/gu)) {
    const cleaned = phrase[1].split(STOP_AFTER_PLACE)[0].trim().replace(/[.,!?]$/, "");
    if (cleaned && !NOT_A_PLACE.has(firstWord(cleaned))) return { value: cleaned, matched: phrase[0] };
  }

  // "Paris", "Madurai 2 days", "Hanoi next week": a place name opening the sentence.
  const opening = raw.match(/^\s*(\p{Lu}[\p{L}'’.-]*(?:\s+\p{Lu}[\p{L}'’.-]*){0,2})(?=\s*(?:[,.!?]|$|\s+(?:for|next|this|in|on|to|with|trip|tomorrow|today|over|during|\d)))/u);
  if (opening && !NOT_A_PLACE.has(firstWord(opening[1]))) return { value: opening[1].trim(), matched: opening[1].trim() };

  return null;
}

/* ---------------------------------------------------------------- duration */

const WORD_NUMBERS: Record<string, number> = {
  a: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

function parseDuration(raw: string): ParsedIntent["durationDays"] {
  const weekend = find(raw, /\blong weekend\b/i);
  if (weekend) return { value: 3, matched: weekend[0] };

  const weekendPlain = find(raw, /\bweekend\b/i);
  if (weekendPlain) return { value: 2, matched: weekendPlain[0] };

  const weeks = find(raw, /\b(\d+|a|one|two|three)\s+weeks?\b/i);
  if (weeks) {
    const count = Number(weeks[1]) || WORD_NUMBERS[weeks[1].toLowerCase()] || 1;
    return { value: Math.min(count * 7, 21), matched: weeks[0] };
  }

  const days = find(raw, /\b(\d+|a|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:days?|nights?)\b/i);
  if (days) {
    const count = Number(days[1]) || WORD_NUMBERS[days[1].toLowerCase()] || 1;
    return { value: Math.min(count, 21), matched: days[0] };
  }

  return null;
}

/* ----------------------------------------------------------------- party */

const PARTY_RULES: { pattern: RegExp; value: TravellerType }[] = [
  { pattern: /\b(?:my wife|my husband|my partner|my girlfriend|my boyfriend|honeymoon|as a couple|with my spouse)\b/i, value: "couple" },
  {
    pattern:
      /\b(?:my kids|our kids|my children|the children|with family|my family|my parents|my in-laws|my (?:elderly |old |older |aged )?(?:mother|mom|mum|father|dad|grandma|grandpa|grandmother|grandfather)|grand ?parents|(?:\d+|a|one|two|three|four) (?:little |young |small )?(?:kids?|children|toddlers?))\b/i,
    value: "family",
  },
  { pattern: /\b(?:with friends|my friends|a group of us|group trip|mates)\b/i, value: "friends" },
  { pattern: /\b(?:business trip|for work|a conference|work trip)\b/i, value: "business" },
  { pattern: /\b(?:solo|alone|by myself|on my own|just me)\b/i, value: "solo" },
];

function parseParty(raw: string): ParsedIntent["travellerType"] {
  for (const rule of PARTY_RULES) {
    const hit = raw.match(rule.pattern);
    if (hit) return { value: rule.value, matched: hit[0] };
  }
  return null;
}

/* -------------------------------------------------------------- interests */

const INTEREST_RULES: { pattern: RegExp; value: Interest }[] = [
  { pattern: /\b(?:food|eat|eating|cuisine|street food|restaurants?|breakfast|dinner|meals?)\b/i, value: "food" },
  { pattern: /\b(?:(?:filter |south indian )?coffee|caf[eé]s?|tea houses?)\b/i, value: "cafes" },
  { pattern: /\b(?:temples?|shrines?|spiritual|meditation|mosques?|churches?|monasteries)\b/i, value: "spiritual" },
  { pattern: /\b(?:history|historical|heritage|ancient|old town|museums?)\b/i, value: "history" },
  { pattern: /\b(?:architecture|buildings?|design)\b/i, value: "architecture" },
  { pattern: /\b(?:nature|outdoors?|hikes?|hiking|hills?|parks?|gardens?|green|forest|mountains?)\b/i, value: "nature" },
  { pattern: /\b(?:markets?|bazaars?|shopping|shops?)\b/i, value: "markets" },
  { pattern: /\b(?:photography|photos?|shooting|camera|film)\b/i, value: "photography" },
  { pattern: /\b(?:local life|locals|everyday|neighbourhoods?|neighborhoods?|streets?|authentic)\b/i, value: "local_life" },
];

function parseInterests(raw: string): ParsedIntent["interests"] {
  const found: ParsedIntent["interests"] = [];
  for (const rule of INTEREST_RULES) {
    const phrases = [...new Set([...raw.matchAll(new RegExp(rule.pattern.source, "gi"))].map((m) => m[0]))];
    if (phrases.length > 0) found.push({ value: rule.value, matched: phrases });
  }
  // In the order the traveller mentioned them.
  return found.sort((a, b) => raw.toLowerCase().indexOf(a.matched[0].toLowerCase()) - raw.toLowerCase().indexOf(b.matched[0].toLowerCase()));
}

/* ------------------------------------------------------------ dial & pace */

const AVOID_PATTERNS = [
  /\b(?:don'?t like|do not like|hate|avoid|no|not into|rather not|without)\s+([^.,;]{3,50})/gi,
];

function parseAvoid(raw: string): string[] {
  const phrases: string[] = [];
  for (const pattern of AVOID_PATTERNS) {
    for (const hit of raw.matchAll(pattern)) {
      const phrase = hit[1]?.trim();
      if (phrase) phrases.push(phrase);
    }
  }
  return phrases.slice(0, 4);
}

function parseDial(raw: string): ParsedIntent["dial"] {
  const away = find(
    raw,
    /\b(?:(?:no|not|nothing|non)\s+(?:too\s+)?touristy|avoid(?:ing)? (?:the )?touristy|touristy stuff|avoid(?:ing)? (?:the )?tourists?|off the beaten|hidden|local(?:'s)? spots?|crowded tourist|tourist traps?|away from (?:the )?crowds?|quiet|less crowded|not? for tourists)\b/i,
  );
  if (away) return { value: "insider", matched: away[0] };

  const classic = find(raw, /\b(?:first time|must[- ]see|highlights|famous|landmarks?|the classics|bucket list)\b/i);
  if (classic) return { value: "tourist", matched: classic[0] };

  return null;
}

function parsePace(raw: string): ParsedIntent["pace"] {
  const slow = find(raw, /\b(?:relaxed|slow|slowly|unhurried|take it easy|chill|no rush|leisurely)\b/i);
  if (slow) return { value: "relaxed", matched: slow[0] };

  const fast = find(raw, /\b(?:packed|see everything|as much as possible|jam[- ]?packed|fit in as much|whirlwind)\b/i);
  if (fast) return { value: "packed", matched: fast[0] };

  return null;
}

/* ------------------------------------------------------------- multi-city */

const PLACE = "\\p{Lu}[\\p{L}'’.-]*(?:\\s+\\p{Lu}[\\p{L}'’.-]*){0,2}";
const JOINER = "(?:\\s*,\\s*(?:and\\s+|then\\s+)?|\\s+and\\s+(?:then\\s+)?|\\s+then\\s+|\\s*(?:→|->|&)\\s*)";
const COUNT = "(\\d+|[Aa]n?|[Oo]ne|[Tt]wo|[Tt]hree|[Ff]our|[Ff]ive|[Ss]ix|[Ss]even|[Ee]ight|[Nn]ine|[Tt]en)";

const cleanPlace = (phrase: string) => phrase.split(STOP_AFTER_PLACE)[0].trim().replace(/[.,!?]$/, "");

function splitDays(cities: string[], totalDays: number | null, matched: string) {
  const total = Math.max(totalDays ?? cities.length * 2, cities.length);
  const base = Math.floor(total / cities.length);
  let extra = total - base * cities.length;
  return cities.map((destination) => ({ destination, days: base + (extra-- > 0 ? 1 : 0), matched }));
}

/**
 * "3 days in Tokyo and 2 days in Kyoto", "a week in Lisbon, Porto and Seville", or "Chennai to
 * Kumbakonam to Thanjavur over 5 days", with the total split evenly. Anything it misreads is shown
 * back as an editable route before a trip is built.
 */
function parseLegs(raw: string, totalDays: number | null): ParsedIntent["legs"] {
  const explicit = [...raw.matchAll(new RegExp(`\\b${COUNT}\\s+(?:[Dd]ays?|[Nn]ights?)\\s+in\\s+(${PLACE})`, "gu"))];
  if (explicit.length >= 2) {
    return explicit.slice(0, 5).map((m) => ({
      destination: cleanPlace(m[2]),
      days: Math.min(Number(m[1]) || WORD_NUMBERS[m[1].toLowerCase()] || 1, 14),
      matched: m[0],
    }));
  }

  const route = raw.match(new RegExp(`^\\s*(${PLACE}(?:\\s+(?:to|→|->)\\s+${PLACE}){1,4})`, "u"));
  if (route) {
    const cities = route[1].split(/\s+(?:to|→|->)\s+/u).map(cleanPlace).filter((city) => city && !NOT_A_PLACE.has(firstWord(city)));
    if (cities.length >= 2) return splitDays(cities.slice(0, 5), totalDays, route[0].trim());
  }

  const chain = raw.match(new RegExp(`\\b(?:in|to|visiting|visit|around|between|through)\\s+(${PLACE}(?:${JOINER}${PLACE})+)`, "u"));
  if (!chain) return null;
  const cities = chain[1]
    .split(new RegExp(JOINER, "u"))
    .map(cleanPlace)
    .filter((city) => city && !NOT_A_PLACE.has(firstWord(city)))
    .slice(0, 5);
  if (cities.length < 2) return null;
  return splitDays(cities, totalDays, chain[0]);
}

/* ------------------------------------------------------------------ entry */

const DAY_MS = 86_400_000;

export function parseIntent(raw: string, clock: Clock = { now: new Date() }): ParsedIntent {
  const text = raw.replace(/\s+/g, " ").trim();
  const dates = parseWhen(text, clock, { longWeekend: /\blong weekend\b/i.test(text) });
  const rangeDays = dates?.endDate ? Math.round((Date.parse(dates.endDate) - Date.parse(dates.startDate)) / DAY_MS) + 1 : null;
  const duration = parseDuration(text) ?? (rangeDays ? { value: rangeDays, matched: dates!.matched } : null);
  const party = readParty(text);
  const namedType = parseParty(text);
  const inferredType = typeFromParty(party);

  return {
    destination: parseDestination(text),
    durationDays: duration,
    dates,
    legs: parseLegs(text, duration?.value ?? null),
    travellerType: namedType ?? (inferredType && party ? { value: inferredType, matched: party.matched } : null),
    party,
    mobility: readMobility(text),
    budget: readBudget(text, { days: duration?.value ?? null }),
    interests: parseInterests(text),
    dial: parseDial(text),
    pace: parsePace(text),
    avoid: parseAvoid(text),
  };
}

/** How much of the sentence we actually understood — drives how loudly we ask for more. */
export function intentCoverage(intent: ParsedIntent): number {
  const signals = [
    intent.destination,
    intent.durationDays,
    intent.travellerType,
    intent.budget,
    intent.interests.length > 0 ? {} : null,
    intent.dial,
    intent.pace,
  ];
  return signals.filter(Boolean).length / signals.length;
}
