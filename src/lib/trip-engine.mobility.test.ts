import { describe, expect, it } from "vitest";
import { staysLink } from "./affiliates";
import { dayDirectionsUrl } from "./export";
import { parseIntent } from "./parse-intent";
import { prefsFromIntent } from "./intent/prefs";
import { buildTrip, perDayLimit, tripNotes } from "./trip-engine";
import type { Recommendation } from "./types";

const clock = { now: new Date("2026-09-15T06:00:00Z"), timeZone: "Asia/Kolkata" };
const BRIEF = "A long weekend in Kumbakonam next month with my parents who can't walk much. We love temples and filter coffee, want to avoid crowds, around 15000 rupees total.";

function stop(index: number, category: Recommendation["category"]): Recommendation {
  return {
    id: `p${index}`,
    name: `Place ${index}`,
    destination: "Kumbakonam",
    tag: category === "cafe" ? "local_favourite" : "small_local",
    category,
    priceBand: "unknown",
    durationMinutes: 60,
    coords: { lat: 10.96 + index * 0.002, lng: 79.38 },
    interests: category === "cafe" ? ["cafes"] : ["spiritual"],
    timeWindow: { start: `${String(7 + index).padStart(2, "0")}:00`, end: `${String(8 + index).padStart(2, "0")}:00` },
    vibe: "",
    description: "",
    whyItFits: {},
    evidenceSource: "test",
    verified: false,
    priority: index + 1,
    facts: category === "cafe" ? { amenity: "cafe", distanceKm: index / 10 } : { amenity: "place_of_worship", religion: "hindu", distanceKm: index / 10 },
  };
}

describe("the Kumbakonam brief", () => {
  const { prefs, guessed } = prefsFromIntent(parseIntent(BRIEF, clock), BRIEF, "INR", clock);

  it("reads limited walking, three adults and a relaxed pace, marked as guesses where inferred", () => {
    expect(prefs.mobility).toBe("limited");
    expect(prefs.adults).toBe(3);
    expect(prefs.children).toBe(0);
    expect(prefs.pace).toBe("relaxed");
    expect(guessed.pace).toBe(true);
    expect(guessed.party).toBe(true);
  });

  it("dates the trip Fri 2 – Sun 4 October and budgets ₹5,000 a day", () => {
    expect(prefs.startDate).toBe("2026-10-02");
    expect(prefs.endDate).toBe("2026-10-04");
    expect(guessed.dates).toBe(true);
    expect(prefs.budgetPerDay).toBe(5000);
    expect(prefs.budget).toEqual({ amount: 15000, currency: "INR", basis: "total", perPerson: false });
  });

  it("keeps days to three stops even at a balanced pace", () => {
    expect(perDayLimit({ pace: "balanced", mobility: "limited" })).toBe(3);
    expect(perDayLimit({ pace: "packed", mobility: "wheelchair" })).toBe(3);
    expect(perDayLimit({ pace: "packed", mobility: "none" })).toBe(7);

    const pool = Array.from({ length: 14 }, (_, i) => stop(i, i % 3 === 0 ? "cafe" : "temple"));
    const trip = buildTrip(pool, { ...prefs, pace: "balanced" });
    expect(trip.days).toHaveLength(3);
    for (const day of trip.days) expect(day.items.length).toBeLessThanOrEqual(3);
    expect(tripNotes(trip)[0]).toBe("We kept days short and walking low. Check steps and access at each place.");
  });

  it("gives driving directions and searches rooms for three adults in October", () => {
    const pool = Array.from({ length: 6 }, (_, i) => stop(i, i % 2 ? "cafe" : "temple"));
    const trip = buildTrip(pool, prefs);
    const url = new URL(dayDirectionsUrl(trip.days[0].items, "driving")!);
    expect(url.searchParams.get("travelmode")).toBe("driving");

    const stays = new URL(
      staysLink({ city: "Kumbakonam", checkin: trip.days[0].date, checkout: "2026-10-05", travellerType: prefs.travellerType, adults: prefs.adults, children: prefs.children }, {}).url,
    );
    expect(stays.searchParams.get("group_adults")).toBe("3");
    expect(stays.searchParams.get("checkin")).toBe("2026-10-02");
    expect(stays.searchParams.has("group_children")).toBe(false);
  });

  it("adds children to the room search when there are any", () => {
    const url = new URL(staysLink({ city: "Pune", checkin: "2026-09-19", checkout: "2026-09-21", travellerType: "family", adults: 2, children: 2 }, {}).url);
    expect(url.searchParams.get("group_children")).toBe("2");
  });
});
