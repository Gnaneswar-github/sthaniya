import { describe, expect, it } from "vitest";
import { groundedPlace } from "./ai/place";
import { landmarkCandidates } from "./landmarks";
import type { Candidate } from "./places/overpass";
import { buildTrip, makeMoreLocal, tripNotes } from "./trip-engine";
import type { PlaceFacts, TripPrefs } from "./types";

const candidate = (ref: string, name: string, facts: PlaceFacts): Candidate => ({
  ref,
  name,
  kind: "place with a Wikipedia article",
  coords: { lat: 10.96 + Number(ref.slice(1)) * 0.001, lng: 79.38 },
  notable: Boolean(facts.hasWikipedia),
  facts,
});

/** A Wikipedia-only candidate list, like the one Kumbakonam gets when Overpass is down. */
const candidates = [
  candidate("w0", "Banapuriswarar Temple", { hasWikipedia: true, articleLength: 3200, distanceKm: 0.4 }),
  candidate("w1", "Sarangapani Temple", { hasWikipedia: true, articleLength: 41000, distanceKm: 0.6 }),
  candidate("w2", "Adi Kumbeswarar Temple", { hasWikipedia: true, articleLength: 18000, distanceKm: 0.3 }),
  candidate("w3", "Kasi Viswanathar Temple, Kumbakonam", { hasWikipedia: true, articleLength: 4100, distanceKm: 0.5 }),
  candidate("w4", "Town Higher Secondary Park", { hasWikipedia: true, articleLength: 90000, distanceKm: 0.2 }),
  candidate("p5", "Rola Bakery", { amenity: "cafe", distanceKm: 0.7 }),
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
};

const ctx = { destination: "Kumbakonam", brief: prefs.notes, region: "Tamil Nadu", countryCode: "IN", priority: 1 };

describe("landmarks from the candidate list", () => {
  it("ranks the town's great temples by article depth and fit, not a park the traveller didn't ask about", () => {
    expect(landmarkCandidates(candidates, prefs.interests).map((c) => c.name)).toEqual(["Sarangapani Temple", "Adi Kumbeswarar Temple"]);
  });

  it("never picks a place with no fame signal", () => {
    expect(landmarkCandidates([candidates[5]], ["cafes"])).toEqual([]);
  });

  it("keeps a landmark the model skipped in the trip, and through 'Make it more local'", () => {
    const chosenByModel = [candidates[0], candidates[3], candidates[5]].map((c, i) => groundedPlace({ ref: c.ref, interests: ["spiritual", "cafes"] }, c, { ...ctx, priority: i + 1 }));
    const landmarks = landmarkCandidates(candidates, prefs.interests).map((c, i) =>
      groundedPlace({ ref: c.ref, interests: prefs.interests, window: { start: "09:00", end: "11:00" } }, c, { ...ctx, priority: 10 + i }),
    );
    const pool = [...chosenByModel, ...landmarks];

    const trip = buildTrip(pool, prefs);
    const names = trip.days.flatMap((d) => d.items).map((i) => i.place.name);
    expect(names).toContain("Sarangapani Temple");
    expect(trip.anchors?.[0].name).toBe("Sarangapani Temple");

    const local = makeMoreLocal(trip, pool).trip;
    expect(local.days.flatMap((d) => d.items).map((i) => i.place.name)).toContain("Sarangapani Temple");
    expect(tripNotes(trip).join(" ")).toContain("Only 1 place for cafés came up on the map near Kumbakonam");
  });
});
