import type { Category, Interest, LocalityTag, PlaceFacts } from "./types";

/**
 * "Real places only" has to cover the words as well as the places. Everything a traveller reads
 * about a drafted place — its category, what it is, its locality label — is derived here from map
 * facts. The model writes only the "why it fits" line, and `groundLine` removes any sentence in it
 * that claims something the facts don't support.
 */

/* --------------------------------------------------------------- category */

const WORSHIP_BY_RELIGION: Record<string, Category> = {
  hindu: "temple",
  buddhist: "temple",
  jain: "temple",
  shinto: "temple",
  taoist: "temple",
  christian: "church",
  muslim: "mosque",
};

const NAME_CHURCH = /\b(?:church|cathedral|basilica|chapel|abbey|igreja|iglesia|église|chiesa)\b/i;
const NAME_MOSQUE = /\b(?:mosque|masjid|camii?|jami|dargah)\b/i;
const NAME_TEMPLE = /\b(?:temple|kovil|koil|mandir|devasthanam|pagoda|shrine|jinja)\b|-(?:dera|ji|in)\b/i;

/**
 * A place's own name outranks a contradicting religion tag: in Kumbakonam, "St. Mary Cathedral" is
 * tagged `religion=hindu` on the map, and it is still a church. A name that says both ("Church Road
 * Temple") falls back to the tag.
 */
function worshipCategory(facts: PlaceFacts, name: string): Category {
  const temple = NAME_TEMPLE.test(name);
  if (NAME_CHURCH.test(name) && !temple) return "church";
  if (NAME_MOSQUE.test(name) && !temple) return "mosque";
  const byReligion = facts.religion ? WORSHIP_BY_RELIGION[facts.religion.toLowerCase()] : undefined;
  if (byReligion) return byReligion;
  if (temple) return "temple";
  return "worship";
}

/** The religion tag, only where it agrees with what the place is. */
export function consistentReligion(category: Category, facts: PlaceFacts): string | undefined {
  if (!facts.religion) return undefined;
  const implied = WORSHIP_BY_RELIGION[facts.religion.toLowerCase()];
  return !implied || implied === category ? facts.religion : undefined;
}

function nameCategory(name: string): Category | null {
  if (NAME_CHURCH.test(name)) return "church";
  if (NAME_MOSQUE.test(name)) return "mosque";
  if (NAME_TEMPLE.test(name)) return "temple";
  if (/\b(?:museum|gallery)\b/i.test(name)) return "museum";
  if (/\b(?:market|bazaar|souk|mandi)\b/i.test(name)) return "market";
  if (/\b(?:park|gardens?|beach|lake|falls|reserve)\b/i.test(name)) return "outdoors";
  return null;
}

/** Never defaults a place of worship to "Temple": a church is a Church, a mosque a Mosque. */
export function categoryFromFacts(facts: PlaceFacts, name: string): Category {
  const { amenity, tourism } = facts;
  if (amenity === "cafe") return "cafe";
  if (amenity && /^(?:restaurant|fast_food|food_court|ice_cream|bakery)$/.test(amenity)) return "food";
  if (amenity === "marketplace") return "market";
  if (amenity === "place_of_worship" || facts.religion) return worshipCategory(facts, name);
  if (tourism === "museum" || tourism === "gallery") return "museum";
  if (facts.leisure === "park" || facts.leisure === "garden" || facts.leisure === "nature_reserve" || facts.natural) return "outdoors";
  return nameCategory(name) ?? "sight";
}

/* ---------------------------------------------------------- evidence scores */

/** 0–1: how much of a visitor landmark the map and Wikipedia say this is. */
export function fameOf(facts: PlaceFacts): number {
  const linked = facts.hasWikipedia || facts.hasWikidata ? 0.45 : 0;
  const heritage = facts.heritage ? 0.3 : 0;
  const attraction = facts.historic || (facts.tourism && /^(?:attraction|museum|gallery|viewpoint|zoo|theme_park)$/.test(facts.tourism)) ? 0.25 : 0;
  // A long article separates a town's great temple from a shrine with a stub.
  const length = facts.articleLength ?? 0;
  const depth = length >= 30_000 ? 0.3 : length >= 12_000 ? 0.2 : length >= 5_000 ? 0.1 : 0;
  return Math.min(1, linked + heritage + attraction + depth);
}

/** 0–1: whether this is a kind of place people use in daily life rather than visit once. */
export function everydayUse(category: Category, facts: PlaceFacts): number {
  switch (category) {
    case "cafe":
    case "food":
    case "market":
      return 1;
    case "temple":
    case "church":
    case "mosque":
    case "worship":
      return 0.9;
    case "outdoors":
      return facts.natural ? 0.5 : 0.7;
    case "museum":
      return 0.1;
    default:
      return 0.3;
  }
}

export function localityTagFor(category: Category, facts: PlaceFacts): LocalityTag {
  if (fameOf(facts) >= 0.45) return "tourist_essential";
  if (category === "cafe" || category === "food" || category === "market") return "local_favourite";
  // No local evidence yet (endorsements are HANDOFF P2-11), so never a "Hidden Gem".
  return "small_local";
}

/* ------------------------------------------------------------ what it is */

const DENOMINATION: Record<string, string> = {
  roman_catholic: "Catholic",
  catholic: "Catholic",
  anglican: "Anglican",
  protestant: "Protestant",
  methodist: "Methodist",
  baptist: "Baptist",
  lutheran: "Lutheran",
  orthodox: "Orthodox",
  russian_orthodox: "Orthodox",
  greek_orthodox: "Orthodox",
  georgian_orthodox: "Orthodox",
  church_of_south_india: "Church of South India",
  sunni: "Sunni",
  shia: "Shia",
};

const human = (value: string) => value.split(";")[0].replace(/_/g, " ").trim();
const capital = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

/** A short, factual line: "Hindu temple · On Wikipedia", "Café · South indian", "Catholic church". */
export function whatItIs(category: Category, facts: PlaceFacts): string {
  const agreed = consistentReligion(category, facts);
  const religion = agreed ? capital(human(agreed)) : "";
  const denomination = facts.denomination ? (DENOMINATION[facts.denomination] ?? capital(human(facts.denomination))) : "";
  let kind: string;
  switch (category) {
    case "temple":
      kind = religion ? `${religion} temple` : "Temple";
      break;
    case "church":
      kind = denomination ? `${denomination} church` : "Church";
      break;
    case "mosque":
      kind = "Mosque";
      break;
    case "worship":
      kind = religion ? `${religion} place of worship` : "Place of worship";
      break;
    case "cafe":
      kind = "Café";
      break;
    case "food":
      kind = facts.amenity === "fast_food" ? "Quick food" : facts.amenity === "bakery" ? "Bakery" : facts.amenity === "ice_cream" ? "Ice cream" : "Restaurant";
      break;
    case "market":
      kind = "Market";
      break;
    case "museum":
      kind = facts.tourism === "gallery" ? "Gallery" : "Museum";
      break;
    case "outdoors":
      kind = facts.leisure === "garden" ? "Garden" : facts.leisure === "nature_reserve" ? "Nature reserve" : facts.natural === "water" ? "Water body" : "Park";
      break;
    default:
      kind =
        facts.tourism === "viewpoint"
          ? "Viewpoint"
          : facts.tourism === "artwork"
            ? "Public artwork"
            : facts.historic && facts.historic !== "yes"
              ? `Historic ${human(facts.historic)}`
              : facts.historic
                ? "Historic site"
                : facts.tourism === "attraction"
                  ? "Visitor attraction"
                  : "Place to see";
  }

  const cuisine = facts.cuisine && (category === "cafe" || category === "food") ? capital(facts.cuisine.split(";").map(human).slice(0, 2).join(", ")) : "";
  const extras = [
    cuisine,
    facts.heritage ? "Listed heritage site" : "",
    facts.fee === "no" ? "Free to enter" : facts.fee === "yes" ? "Entry fee" : "",
    facts.hasWikipedia ? "On Wikipedia" : "",
  ].filter(Boolean);
  return [kind, ...extras].slice(0, 3).join(" · ");
}

/* -------------------------------------------------------------- interests */

/** The interests a place of this kind can honestly be picked for. A restaurant is never "spiritual". */
export function allowedInterests(category: Category, facts?: PlaceFacts): Interest[] {
  const notable = facts ? Boolean(facts.hasWikipedia || facts.hasWikidata || facts.heritage || facts.historic) : true;
  switch (category) {
    case "food":
      return ["food", "local_life"];
    case "cafe":
      return ["cafes", "food", "local_life"];
    case "temple":
    case "church":
    case "mosque":
    case "worship":
      return notable ? ["spiritual", "history", "architecture", "photography", "local_life"] : ["spiritual", "local_life"];
    case "market":
      return ["markets", "food", "local_life", "photography"];
    case "museum":
      return ["history", "architecture", "photography"];
    case "outdoors":
      return ["nature", "photography", "local_life"];
    default:
      return notable ? ["history", "architecture", "photography", "local_life"] : ["architecture", "photography", "local_life"];
  }
}

/** "Tickets & tours" only where the map says people book or pay: never on a small free shrine. */
export function isBookable(facts: PlaceFacts): boolean {
  return (
    Boolean(facts.tourism && /^(?:attraction|museum|gallery|zoo|theme_park|aquarium)$/.test(facts.tourism)) ||
    facts.fee === "yes" ||
    Boolean(facts.hasWikidata && facts.heritage)
  );
}

/* --------------------------------------------------------------- grounding */

export type GroundingContext = { facts: PlaceFacts; category: Category; brief: string; name: string };

type ClaimRule = { pattern: RegExp; supported: (ctx: GroundingContext, word: string) => boolean };

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const inBrief = (ctx: GroundingContext, word: string) => new RegExp(`\\b${escape(word)}\\b`, "i").test(ctx.brief);
const never = () => false;

/**
 * Kinds of claim a model tends to invent. Each is dropped unless a map fact supports it. The list
 * is deliberately blunt: losing a harmless sentence costs little; an invented one costs trust.
 */
const CLAIMS: ClaimRule[] = [
  // Appearance, materials and physical features.
  { pattern: /\b(?:marble|granite|sandstone|stone|carv\w*|frescoe?s|murals?|gopurams?|pillars?|domes?|stained[- ]glass|wooden|brick|tiles?|mosaics?|paintings?|statues?|idols?)\b/i, supported: never },
  { pattern: /\b(?:benches|bench|seating|seats|shade|shaded|shady|toilets?|restrooms?|parking|ramps?|steps|stairs|lifts?|elevators?)\b/i, supported: never },
  { pattern: /\b(?:spacious|ample|large|huge|vast|tiny|small|big|grand|massive|sprawling|courtyards?|sanctum|halls?|towering|intimate|cosy|cozy)\b/i, supported: never },
  // Crowds and atmosphere the map can't know.
  { pattern: /\b(?:crowds?|crowded|busy|bustling|packed|seldom|rarely|often quiet|quiet|quieter|peaceful|tranquil|serene|calm|hidden|secret|off the beaten|lively|vibrant|buzzing|relaxing)\b/i, supported: never },
  // Accessibility, only with a wheelchair tag.
  // Whether a place suits people who can't walk far is exactly what the map rarely says.
  {
    pattern:
      /\b(?:wheelchair|accessible|accessibility|step[- ]free|seniors?|elderly|easy|easily|effortless|gentle|manageable|convenient|comfortable|limited (?:mobility|walk\w*)|walkers?|mobility|parents|grandparents|kids|children|families|suits? (?:older|elderly|kids|children|families))\b/i,
    supported: (ctx) => ctx.facts.wheelchair === "yes" || ctx.facts.wheelchair === "limited",
  },
  // History and age.
  { pattern: /\b(?:colonial|ancient|century|centuries|medieval|historic|history|heritage|old|oldest|dating|built|founded|dynasty|chola|british|portuguese|dutch|french|era)\b/i, supported: (ctx) => Boolean(ctx.facts.historic || ctx.facts.heritage) },
  // Fame.
  { pattern: /\b(?:famous|popular|renowned|iconic|celebrated|well[- ]known|best|finest|legendary|beloved|favou?rite|must[- ]see|landmark|major|important|revered)\b/i, supported: (ctx) => Boolean(ctx.facts.hasWikipedia || ctx.facts.hasWikidata) },
  // Greenery and views.
  { pattern: /\b(?:lush|greenery|green|gardens?|trees|flowers|views?|scenic|river|lake|pond|tank|sunset|sunrise)\b/i, supported: (ctx) => ctx.category === "outdoors" || Boolean(ctx.facts.leisure || ctx.facts.natural || ctx.facts.tourism === "viewpoint") },
  // Food and drink: fine for a café or restaurant when the traveller asked for it, or the map lists it.
  {
    pattern: /\b(?:filter coffee|coffee|tea|chai|dosas?|idlis?|thalis?|biryani|vegetarian|vegan|halal|seafood|espresso|pastr(?:y|ies)|breakfast|lunch|dinner|meals?|snacks?|sweets)\b/i,
    supported: (ctx, word) =>
      ["cafe", "food", "market"].includes(ctx.category) && (inBrief(ctx, word) || Boolean(ctx.facts.cuisine && ctx.facts.cuisine.toLowerCase().includes(word.toLowerCase().split(" ")[0]))),
  },
  // Hours, only when the map lists them.
  { pattern: /\b(?:opens?|closes?|open (?:early|late|daily|all day)|24 hours|hours)\b/i, supported: (ctx) => Boolean(ctx.facts.openingHours) },
  // Money and ratings.
  { pattern: /\b(?:free|entry fee|tickets?|cheap|expensive|affordable|pricey|inexpensive|budget|prices?|priced|rated|ratings?|reviews?|stars?|michelin)\b|[₹$€£¥]/i, supported: (ctx, word) => (word.toLowerCase() === "free" ? ctx.facts.fee === "no" : /ticket|fee/i.test(word) && ctx.facts.fee === "yes") },
];

const MAX_WORDS = 22;

/**
 * Keeps only sentences whose claims the facts support, trimmed to about twenty words. Returns null
 * when nothing survives, so the caller can fall back to a plain line of its own.
 */
/** Abbreviations whose full stop doesn't end a sentence: "St. Mary Cathedral", "Sri. …", "Mt. Abu". */
const ABBREVIATION = /\b(St|Sts|Sri|Smt|Dr|Mt|Ft|No|Rd|Ave|Jr|Sr|vs|approx|e\.g|i\.e)\.\s/gi;
const NAME_TOKEN = " ";
const DOT_TOKEN = "";

export function groundLine(line: string, ctx: GroundingContext): string | null {
  let text = line.replace(/\s+/g, " ").trim();
  if (!text) return null;

  // Protect the place's own name and common abbreviations, so neither splits a sentence or trips a rule.
  if (ctx.name) text = text.replace(new RegExp(escape(ctx.name), "gi"), NAME_TOKEN);
  text = text.replace(ABBREVIATION, (match) => match.replace(".", DOT_TOKEN));

  const kept = text
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => {
      const checked = sentence.replaceAll(NAME_TOKEN, " ").replaceAll(DOT_TOKEN, ".");
      return CLAIMS.every((rule) => {
        const match = checked.match(rule.pattern);
        return !match || rule.supported(ctx, match[0]);
      });
    });
  const restore = (value: string) => value.replaceAll(NAME_TOKEN, ctx.name).replaceAll(DOT_TOKEN, ".");
  const result = restore(kept.join(" ")).trim();
  // A fragment ("St.") is not a line worth showing.
  if (kept.length === 0 || result.split(" ").filter((word) => /\p{L}/u.test(word)).length < 3) return null;

  const words = result.split(" ");
  if (words.length <= MAX_WORDS) return result;
  return `${words.slice(0, MAX_WORDS).join(" ").replace(/[,;:—-]+$/, "")}.`;
}
