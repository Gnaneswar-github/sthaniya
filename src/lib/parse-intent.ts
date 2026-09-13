import { DESTINATIONS } from "./destinations";
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
  travellerType: { value: TravellerType; matched: string } | null;
  budgetPerDay: { value: number; currency: string; matched: string } | null;
  interests: { value: Interest; matched: string }[];
  dial: { value: DialPosition; matched: string } | null;
  pace: { value: Pace; matched: string } | null;
  /** Phrases we recognised as dislikes — shown back so nothing looks silently ignored. */
  avoid: string[];
};

function find(text: string, pattern: RegExp): RegExpMatchArray | null {
  return text.match(pattern);
}

/* ------------------------------------------------------------- destination */

const STOP_AFTER_PLACE = /\b(?:with|for|and|but|we|i|my|our|on|during|in|around|next|this)\b/i;

function parseDestination(raw: string): Evidence {
  // A curated destination named anywhere in the sentence wins — we know these are real.
  for (const destination of DESTINATIONS) {
    const pattern = new RegExp(`\\b${destination.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    const hit = raw.match(pattern);
    if (hit) return { value: destination.name, matched: hit[0] };
  }

  const phrase = find(raw, /\b(?:in|to|around|visiting|visit|explore|exploring)\s+([A-Z][\w'’-]*(?:\s+[A-Z][\w'’-]*){0,2})/);
  if (phrase) {
    const cleaned = phrase[1].split(STOP_AFTER_PLACE)[0].trim().replace(/[.,!?]$/, "");
    if (cleaned) return { value: cleaned, matched: phrase[0] };
  }

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
  { pattern: /\b(?:my kids|our kids|my children|the children|with family|my family|my parents)\b/i, value: "family" },
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

/* ---------------------------------------------------------------- budget */

const CURRENCY_BY_SYMBOL: Record<string, string> = {
  "₹": "INR", $: "USD", "€": "EUR", "£": "GBP", "¥": "JPY",
};

function parseBudget(raw: string): ParsedIntent["budgetPerDay"] {
  const hit = find(
    raw,
    /([₹$€£¥]|\b(?:INR|USD|EUR|GBP|JPY|RS|RUPEES|DOLLARS?)\b)?\s*([\d,]+)\s*(?:([₹$€£¥]|\b(?:INR|USD|EUR|GBP|JPY|RS|RUPEES|DOLLARS?)\b)\s*)?(?:per day|a day|\/\s*day|each day|daily|per night|a night)/i,
  );
  if (!hit) return null;

  const token = (hit[1] ?? hit[3] ?? "").trim().toUpperCase();
  const currency = CURRENCY_BY_SYMBOL[token] ?? (token === "RS" || token === "RUPEES" ? "INR" : token === "DOLLAR" || token === "DOLLARS" ? "USD" : token || "INR");
  const amount = Number(hit[2].replace(/,/g, ""));
  if (!Number.isFinite(amount) || amount <= 0) return null;

  return { value: amount, currency, matched: hit[0].trim() };
}

/* -------------------------------------------------------------- interests */

const INTEREST_RULES: { pattern: RegExp; value: Interest }[] = [
  { pattern: /\b(?:food|eat|eating|cuisine|street food|restaurants?|breakfast|dinner|meals?)\b/i, value: "food" },
  { pattern: /\b(?:caf[eé]s?|coffee|tea houses?)\b/i, value: "cafes" },
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
    const hit = raw.match(rule.pattern);
    if (hit && !found.some((f) => f.value === rule.value)) {
      found.push({ value: rule.value, matched: hit[0] });
    }
  }
  return found;
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
    /\b(?:(?:no|not|nothing|non)\s+(?:too\s+)?touristy|avoid(?:ing)? (?:the )?tourists?|off the beaten|hidden|local(?:'s)? spots?|crowded tourist|tourist traps?|away from (?:the )?crowds?|quiet|less crowded|not? for tourists)\b/i,
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

/* ------------------------------------------------------------------ entry */

export function parseIntent(raw: string): ParsedIntent {
  const text = raw.replace(/\s+/g, " ").trim();

  return {
    destination: parseDestination(text),
    durationDays: parseDuration(text),
    travellerType: parseParty(text),
    budgetPerDay: parseBudget(text),
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
    intent.budgetPerDay,
    intent.interests.length > 0 ? {} : null,
    intent.dial,
    intent.pace,
  ];
  return signals.filter(Boolean).length / signals.length;
}
