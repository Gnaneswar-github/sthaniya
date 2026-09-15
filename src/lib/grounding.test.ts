import { describe, expect, it } from "vitest";
import { groundedPlace } from "./ai/place";
import { categoryFromFacts, groundLine, isBookable, whatItIs } from "./grounding";
import type { Candidate } from "./places/overpass";
import type { PlaceFacts } from "./types";

const BRIEF = "A long weekend in Kumbakonam next month with my parents who can't walk much. We love temples and filter coffee, want to avoid crowds, around 15000 rupees total.";

function candidate(name: string, facts: PlaceFacts): Candidate {
  return { ref: "p1", name, kind: "place", coords: { lat: 10.96, lng: 79.38 }, notable: Boolean(facts.hasWikipedia), facts };
}

const ctx = { destination: "Kumbakonam", brief: BRIEF, region: "Tamil Nadu", countryCode: "IN", priority: 1 };
const shrine = candidate("Sri Karumbairam Vinayagar Temple", { amenity: "place_of_worship", religion: "hindu", distanceKm: 1.2 });

describe("fake model outputs", () => {
  it("1. keeps a clean line that only uses the brief and the facts", () => {
    const place = groundedPlace({ ref: "p1", interests: ["spiritual"], whyItFits: { spiritual: "A Hindu temple for the temples you asked for." } }, shrine, ctx);
    expect(place.whyItFits.spiritual).toBe("A Hindu temple for the temples you asked for.");
    expect(place.category).toBe("temple");
    expect(place.vibe).toBe("Hindu temple");
    expect(place.description).toBe("");
  });

  it("2. removes an invented material ('marble-lined sanctum')", () => {
    const temple = candidate("Thiru Meenakshi Sundareshwarar Temple", { amenity: "place_of_worship", religion: "hindu" });
    const place = groundedPlace(
      { ref: "p1", interests: ["spiritual"], whyItFits: { spiritual: "Its marble-lined sanctum has spacious courtyards. A temple for your trip." } },
      temple,
      ctx,
    );
    expect(place.whyItFits.spiritual).toBe("A temple for your trip.");
    expect(JSON.stringify(place)).not.toMatch(/marble|courtyard/i);
  });

  it("3. removes an invented crowd claim ('seldom visited')", () => {
    const place = groundedPlace({ ref: "p1", interests: ["spiritual"], whyItFits: { spiritual: "It is small and seldom visited, so it's often quiet." } }, shrine, ctx);
    expect(place.whyItFits.spiritual).toBeUndefined();
  });

  it("4. removes an accessibility claim without a wheelchair tag, and keeps it with one", () => {
    const untagged = groundedPlace({ ref: "p1", interests: ["spiritual"], whyItFits: { spiritual: "Ample space for seniors to rest." } }, shrine, ctx);
    expect(untagged.whyItFits.spiritual).toBeUndefined();

    const tagged = candidate("Step Free Temple", { amenity: "place_of_worship", religion: "hindu", wheelchair: "yes" });
    const kept = groundedPlace({ ref: "p1", interests: ["spiritual"], whyItFits: { spiritual: "Wheelchair access is listed for this temple." } }, tagged, ctx);
    expect(kept.whyItFits.spiritual).toBe("Wheelchair access is listed for this temple.");
  });

  it("5. labels a church a Church whatever the model says, with no tickets on a free place", () => {
    const church = candidate("St. Mary Cathedral", { amenity: "place_of_worship", religion: "christian", denomination: "roman_catholic" });
    const place = groundedPlace(
      { ref: "p1", interests: ["spiritual", "food"], whyItFits: { spiritual: "A colonial-style church.", food: "Great for lunch." } },
      church,
      ctx,
    );
    expect(place.category).toBe("church");
    expect(place.vibe).toBe("Catholic church");
    expect(place.bookable).toBe(false);
    expect(place.whyItFits.spiritual).toBeUndefined();
    // A church can't be picked for food.
    expect(place.interests).toEqual(["spiritual"]);
    expect(place.whyItFits.food).toBeUndefined();
  });
});

describe("a mis-tagged church", () => {
  it("labels St. Mary Cathedral a Church even though the map tags it religion=hindu, with no temple hours rule", () => {
    const misTagged = candidate("St. Mary Cathedral", { amenity: "place_of_worship", religion: "hindu" });
    const place = groundedPlace({ ref: "p1", interests: ["spiritual"], whyItFits: {} }, misTagged, ctx);
    expect(place.category).toBe("church");
    expect(place.vibe).toBe("Church");
    expect(place.hoursRule).toBeUndefined();
    expect(place.bookable).toBe(false);
  });

  it("still trusts the tag when the name says both", () => {
    expect(categoryFromFacts({ amenity: "place_of_worship", religion: "hindu" }, "Church Road Temple")).toBe("temple");
  });
});

describe("categories from map tags", () => {
  it.each([
    [{ amenity: "place_of_worship", religion: "muslim" }, "Big Mosque", "mosque"],
    [{ amenity: "place_of_worship" }, "Our Lady Church", "church"],
    [{ amenity: "place_of_worship" }, "Sri Kasi Viswanathar Kovil", "temple"],
    [{ amenity: "place_of_worship", religion: "sikh" }, "Gurudwara", "worship"],
    [{ amenity: "place_of_worship" }, "Community Prayer Hall", "worship"],
    [{ amenity: "cafe", cuisine: "coffee_shop" }, "Mami's Coffee", "cafe"],
    [{ amenity: "restaurant" }, "Sri Venkatramana", "food"],
    [{ tourism: "museum" }, "Town Museum", "museum"],
    [{ hasWikipedia: true }, "Airavatesvara Temple", "temple"],
    [{ natural: "water", hasWikipedia: true }, "Mahamaham Tank", "outdoors"],
  ] as [PlaceFacts, string, string][])("%o %s → %s", (facts, name, category) => {
    expect(categoryFromFacts(facts, name)).toBe(category);
  });

  it("describes places only from their facts", () => {
    expect(whatItIs("food", { amenity: "restaurant", cuisine: "south_indian;vegetarian" })).toBe("Restaurant · South indian, vegetarian");
    expect(whatItIs("temple", { religion: "hindu", heritage: "2", hasWikipedia: true })).toBe("Hindu temple · Listed heritage site · On Wikipedia");
  });

  it("offers tickets only where the map says people book or pay", () => {
    expect(isBookable({ amenity: "place_of_worship", religion: "hindu" })).toBe(false);
    expect(isBookable({ tourism: "museum" })).toBe(true);
    expect(isBookable({ fee: "yes" })).toBe(true);
    expect(isBookable({ hasWikidata: true, heritage: "1" })).toBe(true);
  });
});

describe("groundLine", () => {
  const base = { facts: {} as PlaceFacts, category: "cafe" as const, brief: BRIEF, name: "Mami's Coffee" };

  it("allows food words for a café when the traveller asked for them", () => {
    expect(groundLine("A café stop for the filter coffee you mentioned.", base)).toBe("A café stop for the filter coffee you mentioned.");
    expect(groundLine("Famous for its biryani.", base)).toBeNull();
  });

  it("ignores words that are part of the place's own name", () => {
    expect(groundLine("Town Hall Square for your photography.", { ...base, category: "sight", name: "Town Hall Square" })).toBe("Town Hall Square for your photography.");
  });

  it("doesn't split a sentence at the full stop in a name like 'St. Mary Cathedral'", () => {
    const church = { ...base, category: "church" as const, name: "St. Mary Cathedral" };
    expect(groundLine("St. Mary Cathedral is a Catholic church 0.8 km from centre for your spiritual interest.", church)).toBe(
      "St. Mary Cathedral is a Catholic church 0.8 km from centre for your spiritual interest.",
    );
    expect(groundLine("Visit St. Joseph's nearby for a spiritual stop.", { ...church, name: "Other Church" })).toBe("Visit St. Joseph's nearby for a spiritual stop.");
  });

  it("drops a fragment too short to be a line", () => {
    expect(groundLine("St.", { ...base, category: "church", name: "X" })).toBeNull();
  });

  it("trims long lines to about twenty words", () => {
    const long = groundLine(Array.from({ length: 40 }, () => "coffee").join(" "), base)!;
    expect(long.split(" ").length).toBeLessThanOrEqual(22);
  });

  it.each([
    "Temple 1.5 km away fits short, easy visit for limited walkers",
    "Nearby temple allows brief stop for parents with limited mobility",
    "A comfortable stop for the whole family.",
  ])("drops a suitability claim the map can't support: %s", (line) => {
    expect(groundLine(line, { ...base, category: "temple", name: "Gauthameswarar Temple" })).toBeNull();
  });

  it("keeps a plain line about distance and interest", () => {
    expect(groundLine("Temple 1.2 km from centre for your spiritual interest.", { ...base, category: "temple", name: "Ekambeswarar Temple" })).toBe(
      "Temple 1.2 km from centre for your spiritual interest.",
    );
  });

  it("drops invented fame without a Wikipedia link, and allows it with one", () => {
    expect(groundLine("One of the most famous temples in town.", { ...base, category: "temple", name: "X" })).toBeNull();
    expect(groundLine("A famous temple for your spiritual interest.", { ...base, category: "temple", name: "X", facts: { hasWikipedia: true } })).not.toBeNull();
  });
});
