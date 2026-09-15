import { describe, expect, it } from "vitest";
import { localityTagFor } from "./grounding";
import { buildTrip, chooseAnchors, localScoreBreakdown, makeMoreLocal, placeLocalScore, slowDown, tripNotes, whyItFitsLine } from "./trip-engine";
import type { Category, Interest, PlaceFacts, Recommendation, TripPrefs } from "./types";

let priority = 0;
function fixture(name: string, category: Category, facts: PlaceFacts, start: string, interests: Interest[]): Recommendation {
  priority += 1;
  return {
    id: name.toLowerCase().replace(/\W+/g, "-"),
    name,
    destination: "Kumbakonam",
    tag: localityTagFor(category, facts),
    category,
    priceBand: "unknown",
    durationMinutes: 60,
    coords: { lat: 10.96 + (facts.distanceKm ?? 0) / 111, lng: 79.38 },
    interests,
    timeWindow: { start, end: `${String(Number(start.slice(0, 2)) + 1).padStart(2, "0")}:00` },
    vibe: "",
    description: "",
    whyItFits: {},
    evidenceSource: "openstreetmap+ai",
    verified: false,
    priority,
    facts,
  };
}

const temple = (name: string, facts: PlaceFacts, start: string) =>
  fixture(name, "temple", { amenity: "place_of_worship", religion: "hindu", ...facts }, start, ["spiritual"]);
const cafe = (name: string, distanceKm: number, start: string) => fixture(name, "cafe", { amenity: "cafe", cuisine: "coffee;indian", distanceKm }, start, ["cafes"]);

/** Fixture candidates modelled on the Kumbakonam test: two major temples, many small shrines, a few cafés. */
const pool: Recommendation[] = [
  temple("Sarangapani Temple", { hasWikipedia: true, hasWikidata: true, heritage: "2", distanceKm: 0.6 }, "07:00"),
  temple("Adi Kumbeswarar Temple", { hasWikipedia: true, distanceKm: 0.4 }, "08:00"),
  temple("Small Shrine One", { distanceKm: 0.3 }, "09:00"),
  temple("Small Shrine Two", { distanceKm: 1.1 }, "10:00"),
  temple("Small Shrine Three", { distanceKm: 2.4 }, "16:00"),
  temple("Small Shrine Four", { distanceKm: 3.2 }, "17:00"),
  temple("Small Shrine Five", { distanceKm: 0.9 }, "18:00"),
  temple("Small Shrine Six", { distanceKm: 1.8 }, "07:00"),
  temple("Small Shrine Seven", { distanceKm: 2.7 }, "19:00"),
  cafe("Mami's Filter Coffee", 0.5, "13:00"),
  cafe("Kumbakonam Degree Coffee", 1.5, "12:00"),
  cafe("Station Road Café", 2.2, "14:00"),
  fixture("Hotel Sri Venkatramana", "food", { amenity: "restaurant", cuisine: "south_indian", distanceKm: 0.8 }, "12:00", ["food"]),
];

const prefs: TripPrefs = {
  destination: "Kumbakonam",
  startDate: "2026-10-02",
  endDate: "2026-10-04",
  travellerType: "family",
  interests: ["spiritual", "cafes"],
  dial: "local",
  pace: "relaxed",
  budgetPerDay: 5000,
  budgetCurrency: "INR",
  notes: "We love temples and filter coffee",
  mobility: "limited",
  adults: 3,
  children: 0,
};

const namesOf = (items: { place: Recommendation }[]) => items.map((i) => i.place.name);
const smallShrines = (items: { place: Recommendation }[]) => items.filter((i) => i.place.tag === "small_local" && i.place.category === "temple").length;

describe("local labels and scores", () => {
  it("labels major temples Tourist Essential and small shrines 'Small local place', never Hidden Gem", () => {
    expect(pool[0].tag).toBe("tourist_essential");
    expect(pool[2].tag).toBe("small_local");
    expect(pool.some((p) => p.tag === "hidden_gem")).toBe(false);
  });

  it("gives different scores to places with the same label, with a breakdown that adds up", () => {
    const shrineScores = pool.filter((p) => p.tag === "small_local").map(placeLocalScore);
    expect(new Set(shrineScores).size).toBeGreaterThan(1);
    const { score, parts } = localScoreBreakdown(pool[3]);
    expect(parts.reduce((sum, part) => sum + part.points, 0)).toBe(score);
    expect(placeLocalScore(pool[0])).toBeLessThan(placeLocalScore(pool[2]));
  });

  it("chooses the major temples as anchors", () => {
    expect(chooseAnchors(pool, prefs).map((p) => p.name)).toEqual(["Sarangapani Temple", "Adi Kumbeswarar Temple"]);
  });
});

describe("the plan at Local", () => {
  const trip = buildTrip(pool, prefs);
  const all = trip.days.flatMap((d) => d.items);

  it("includes the anchors", () => {
    expect(namesOf(all)).toContain("Sarangapani Temple");
    expect(namesOf(all)).toContain("Adi Kumbeswarar Temple");
  });

  it("has a coffee stop every day and at most two small shrines a day", () => {
    for (const day of trip.days) {
      expect(day.items.some((i) => i.place.category === "cafe")).toBe(true);
      expect(smallShrines(day.items)).toBeLessThanOrEqual(2);
      expect(day.items.length).toBeLessThanOrEqual(3);
    }
  });

  it("keeps Sarangapani and the variety cap after 'Make it more local'", () => {
    const { trip: local, summary } = makeMoreLocal(trip, pool);
    const names = namesOf(local.days.flatMap((d) => d.items));
    expect(names).toContain("Sarangapani Temple");
    expect(summary).toContain("Kept Sarangapani Temple");
    for (const day of local.days) {
      expect(smallShrines(day.items)).toBeLessThanOrEqual(2);
      expect(day.items.some((i) => i.place.category === "cafe")).toBe(true);
    }
  });

  it("never removes an anchor when slowing down, and keeps the local score roughly stable", () => {
    const before = trip.days.flatMap((d) => d.items).length;
    const { trip: slower } = slowDown(trip);
    const names = namesOf(slower.days.flatMap((d) => d.items));
    expect(names).toContain("Sarangapani Temple");
    expect(names).toContain("Adi Kumbeswarar Temple");
    expect(names.length).toBeLessThan(before);
  });

  it("never says a restaurant was picked for the spiritual", () => {
    const restaurant = pool.find((p) => p.category === "food")!;
    const line = whyItFitsLine({ ...restaurant, interests: ["spiritual"] }, prefs, (id) => id);
    expect(line).not.toMatch(/spiritual/i);
    expect(line).toBe("A nearby food stop between your other plans.");
  });
});

describe("when the map has nothing for an interest", () => {
  it("says so instead of silently leaving it out", () => {
    const templesOnly = pool.filter((p) => p.category === "temple");
    const trip = buildTrip(templesOnly, prefs);
    expect(tripNotes(trip).join(" ")).toContain("We couldn't find any places for cafés in Kumbakonam on the map this time");
    expect(buildTrip(pool, prefs).notes).toEqual([]);
  });

  it("says when there are fewer places for an interest than days", () => {
    const oneCafe = pool.filter((p) => p.category !== "cafe" || p.name === "Mami's Filter Coffee");
    const notes = tripNotes(buildTrip(oneCafe, prefs)).join(" ");
    expect(notes).toContain("Only 1 place for cafés came up on the map near Kumbakonam, so not every day has one.");
  });
});

describe("the plan at Insider", () => {
  it("may leave the anchors out, and says what's being skipped", () => {
    const trip = buildTrip(pool, { ...prefs, dial: "insider" });
    const names = namesOf(trip.days.flatMap((d) => d.items));
    expect(names).not.toContain("Sarangapani Temple");
    expect(tripNotes(trip).join(" ")).toContain("You're skipping Sarangapani Temple and Adi Kumbeswarar Temple");
  });
});
