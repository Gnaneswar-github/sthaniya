import type { Mobility, TravellerType, TripPrefs } from "../types";

/**
 * Who is travelling and how they get around. "My parents who can't walk much" is three adults and
 * limited walking — it has to shorten the days, change the directions and fix the room search.
 * Inferred headcounts are marked as guesses so the traveller can correct them.
 */

export type MobilityReading = { value: Exclude<Mobility, "none">; matched: string } | null;
export type PartyReading = { adults: number; children: number; guessed: boolean; matched: string } | null;

const WORD_NUMBERS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
};
const count = (token: string) => Number(token) || WORD_NUMBERS[token.toLowerCase()] || 0;
const NUM = "(\\d{1,2}|a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)";

const MOBILITY_RULES: { value: Exclude<Mobility, "none">; pattern: RegExp }[] = [
  { value: "wheelchair", pattern: /\bwheel ?chairs?\b/i },
  {
    value: "limited",
    pattern:
      /\b(?:can(?:'|’|no)?t walk(?: (?:much|far|long|a lot|for long))?|cannot walk(?: (?:much|far|long))?|unable to walk(?: (?:much|far))?|not able to walk(?: (?:much|far))?|(?:don'?t|do not) walk (?:much|far)|bad knees?|knee (?:problems?|pain|issues?)|elderly|senior citizens?|seniors?|older parents|aged parents|grand ?parents|grand(?:ma|pa|mother|father)|limited mobility|mobility (?:issues?|problems?)|(?:difficulty|trouble) walking|walking stick|uses? a walker)\b/i,
  },
  { value: "pram", pattern: /\b(?:prams?|strollers?|buggy|buggies|pushchairs?|toddlers?|bab(?:y|ies)|infants?|newborn)\b/i },
];

export function readMobility(text: string): MobilityReading {
  for (const rule of MOBILITY_RULES) {
    const hit = text.match(rule.pattern);
    if (hit) return { value: rule.value, matched: hit[0] };
  }
  return null;
}

export function readParty(text: string): PartyReading {
  const phrases: string[] = [];
  let adults: number | null = null;
  let children = 0;
  let guessed = false;

  const group = text.match(new RegExp(`\\b${NUM}\\s+(?:of us|people|persons|adults|travell?ers|pax)\\b|\\b(?:party|group) of ${NUM}\\b|\\bwe(?:'re| are) ${NUM}\\b`, "i"));
  if (group) {
    adults = count(group[1] ?? group[2] ?? group[3]);
    phrases.push(group[0]);
  }

  const kids = text.match(new RegExp(`\\b${NUM}\\s+(?:little\\s+|young\\s+|small\\s+)?(?:kids?|children|child|toddlers?|bab(?:y|ies)|little ones|sons|daughters)\\b`, "i"));
  if (kids) {
    children = count(kids[1]);
    phrases.push(kids[0]);
  } else {
    const someKids = text.match(/\b(?:my|our|the|with)\s+(?:kids|children|little ones)\b/i);
    const oneKid = text.match(/\b(?:my|our)\s+(?:baby|toddler|son|daughter|child|kid)\b/i);
    if (someKids) {
      children = 2;
      guessed = true;
      phrases.push(someKids[0]);
    } else if (oneKid) {
      children = 1;
      guessed = true;
      phrases.push(oneKid[0]);
    }
  }

  if (adults === null) {
    const couple = text.match(/\bmy\s+(?:wife|husband|partner|spouse|girlfriend|boyfriend|fianc[ée]e?)\b|\bhoneymoon\b|\bas a couple\b/i);
    const parents = text.match(/\bmy (?:elderly |old |older |aged )?(?:parents|in-laws|grand ?parents)\b/i);
    const oneParent = text.match(/\bmy (?:elderly |old |older |aged )?(?:mother|mom|mum|father|dad|grandma|grandpa|grandmother|grandfather)\b/i);
    const solo = text.match(/\b(?:solo|alone|by myself|on my own|just me)\b/i);
    if (couple) {
      adults = 2;
      phrases.push(couple[0]);
    } else if (parents) {
      // The parents and the person writing.
      adults = 3;
      guessed = true;
      phrases.push(parents[0]);
    } else if (oneParent) {
      adults = 2;
      guessed = true;
      phrases.push(oneParent[0]);
    } else if (solo) {
      adults = 1;
      phrases.push(solo[0]);
    }
  }

  if (adults === null && children > 0) {
    adults = 2;
    guessed = true;
  }
  if (adults === null) return null;
  return { adults, children, guessed, matched: phrases.join(" · ") };
}

/** A traveller type the headcount alone makes clear, when the sentence named none. */
export function typeFromParty(party: PartyReading): TravellerType | null {
  if (!party) return null;
  if (party.children > 0) return "family";
  if (party.adults === 1) return "solo";
  return null;
}

export const defaultAdults = (type: TravellerType) => (type === "solo" || type === "business" ? 1 : 2);

/** Everyone on the trip, for splitting a budget and searching rooms. */
export function travellersIn(prefs: Pick<TripPrefs, "adults" | "children" | "travellerType">): { adults: number; children: number; total: number } {
  const adults = prefs.adults ?? defaultAdults(prefs.travellerType);
  const children = prefs.children ?? 0;
  return { adults, children, total: adults + children };
}
