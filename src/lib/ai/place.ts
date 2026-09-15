import { allowedInterests, categoryFromFacts, consistentReligion, groundLine, isBookable, localityTagFor, whatItIs } from "../grounding";
import { matchHoursDefault } from "../hours-defaults";
import { parseOpeningHours } from "../opening-hours";
import type { Candidate } from "../places/overpass";
import { INTERESTS, type Interest, type Recommendation } from "../types";

/** What the model is asked to return per place. Anything else it adds is ignored. */
export type RawPlace = {
  ref?: string;
  interests?: string[];
  durationMinutes?: number;
  window?: { start?: string; end?: string };
  whyItFits?: Record<string, unknown>;
};

export type PlaceContext = {
  destination: string;
  /** The traveller's own sentence: the only source besides the facts a fit line may draw on. */
  brief: string;
  region: string | null;
  countryCode: string | null;
  priority: number;
};

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const INTEREST_IDS = INTERESTS.map((i) => i.id) as Interest[];

const clampDuration = (value: unknown) => Math.min(240, Math.max(30, Math.round(typeof value === "number" ? value : 60)));

/**
 * Turns a model selection into a stop. The name, coordinates, category, label and the "what it
 * is" line all come from the map candidate; the model contributes only its choice, a time window,
 * the interests (limited to those the place can honestly serve) and a fit line that is grounded
 * sentence by sentence.
 */
export function groundedPlace(raw: RawPlace, candidate: Candidate, ctx: PlaceContext): Recommendation {
  const facts = candidate.facts;
  const category = categoryFromFacts(facts, candidate.name);
  const allowed = allowedInterests(category, facts);

  const interests = [
    ...new Set((raw.interests ?? []).filter((i): i is Interest => INTEREST_IDS.includes(i as Interest) && allowed.includes(i as Interest))),
  ];

  const whyItFits: Partial<Record<Interest, string>> = {};
  for (const [key, value] of Object.entries(raw.whyItFits ?? {})) {
    if (!allowed.includes(key as Interest) || typeof value !== "string") continue;
    const line = groundLine(value, { facts, category, brief: ctx.brief, name: candidate.name });
    if (line) whyItFits[key as Interest] = line;
  }

  const start = TIME.test(raw.window?.start ?? "") ? raw.window!.start! : "10:00";
  const end = TIME.test(raw.window?.end ?? "") ? raw.window!.end! : "12:00";
  const hoursRule = parseOpeningHours(facts.openingHours) || facts.openingHours
    ? undefined
    : matchHoursDefault({ religion: consistentReligion(category, facts), category, region: ctx.region, countryCode: ctx.countryCode })?.id;

  return {
    id: `ai-${ctx.destination.toLowerCase().replace(/\s+/g, "-")}-${candidate.ref}`,
    // The name always comes from the map, never from the model.
    name: candidate.name,
    destination: ctx.destination,
    tag: localityTagFor(category, facts),
    category,
    // Always unknown: the model has no pricing source. Prices appear only where a person checked.
    priceBand: "unknown",
    durationMinutes: clampDuration(raw.durationMinutes),
    coords: candidate.coords,
    openingHours: facts.openingHours,
    wikidata: candidate.wikidata,
    wikipedia: candidate.wikipedia,
    interests: interests.length > 0 ? interests : [allowed[0]],
    timeWindow: { start, end },
    vibe: whatItIs(category, facts),
    description: "",
    whyItFits,
    evidenceSource: "openstreetmap+ai",
    verified: false,
    priority: ctx.priority,
    facts,
    bookable: isBookable(facts),
    hoursRule,
  };
}
