import { describe, expect, it } from "vitest";
import { legDates, mergeLegTrips, withLegs } from "./legs";
import { parseIntent } from "./parse-intent";
import { buildTrip } from "./trip-engine";
import type { Recommendation, TripPrefs } from "./types";

const prefs: TripPrefs = {
  destination: "Tokyo",
  startDate: "2026-11-02",
  endDate: "2026-11-04",
  travellerType: "couple",
  interests: ["food"],
  dial: "local",
  pace: "balanced",
  budgetPerDay: 0,
  budgetCurrency: "JPY",
  notes: "",
};

describe("routes", () => {
  it("lays legs end to end and keeps the label and end date in step", () => {
    const route = withLegs(prefs, [
      { destination: "Tokyo", days: 3 },
      { destination: "Kyoto", days: 2 },
    ]);
    expect(route.destination).toBe("Tokyo → Kyoto");
    expect(route.endDate).toBe("2026-11-06");
    expect(legDates(route)).toEqual([
      { destination: "Tokyo", startDate: "2026-11-02", endDate: "2026-11-04" },
      { destination: "Kyoto", startDate: "2026-11-05", endDate: "2026-11-06" },
    ]);
  });

  it("collapses back to a single destination when a route shrinks to one city", () => {
    const single = withLegs({ ...prefs, destination: "Tokyo → Kyoto" }, [{ destination: "Kyoto", days: 4 }]);
    expect(single.legs).toBeUndefined();
    expect(single.destination).toBe("Kyoto");
    expect(single.endDate).toBe("2026-11-05");
  });

  it("tags each day of a joined trip with its city", () => {
    const place = (id: string, destination: string): Recommendation =>
      ({
        id,
        name: id,
        destination,
        tag: "local_favourite",
        category: "sight",
        priceBand: "unknown",
        durationMinutes: 60,
        interests: ["food"],
        timeWindow: { start: "10:00", end: "11:00" },
        vibe: "",
        description: "",
        whyItFits: {},
        evidenceSource: "test",
        verified: false,
        priority: 1,
      }) as Recommendation;

    const route = withLegs(prefs, [
      { destination: "Tokyo", days: 1 },
      { destination: "Kyoto", days: 1 },
    ]);
    const [tokyo, kyoto] = legDates(route);
    const trip = mergeLegTrips(route, [
      { destination: "Tokyo", trip: buildTrip([place("a", "Tokyo")], { ...route, ...tokyo, legs: undefined }) },
      { destination: "Kyoto", trip: buildTrip([place("b", "Kyoto")], { ...route, ...kyoto, legs: undefined }) },
    ]);
    expect(trip.days.map((d) => `${d.date} ${d.destination}`)).toEqual(["2026-11-02 Tokyo", "2026-11-03 Kyoto"]);
  });
});

describe("reading routes from a sentence", () => {
  it("reads explicit days per city", () => {
    const intent = parseIntent("3 days in Tokyo and 2 days in Kyoto with my wife");
    expect(intent.legs).toEqual([
      expect.objectContaining({ destination: "Tokyo", days: 3 }),
      expect.objectContaining({ destination: "Kyoto", days: 2 }),
    ]);
  });

  it("splits a total across a chain of cities", () => {
    const intent = parseIntent("A week in Lisbon, Porto and Seville");
    expect(intent.legs?.map((l) => l.destination)).toEqual(["Lisbon", "Porto", "Seville"]);
    expect(intent.legs?.reduce((sum, l) => sum + l.days, 0)).toBe(7);
  });

  it("leaves single-city sentences alone", () => {
    expect(parseIntent("3 days in Tokyo with my wife").legs).toBeNull();
  });
});
