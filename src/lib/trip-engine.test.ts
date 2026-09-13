import { describe, expect, it } from "vitest";
import { buildTrip, makeCheaper, makeMoreLocal } from "./trip-engine";
import type { Recommendation, TripPrefs } from "./types";

/** A drafted place: real name, no pricing source — exactly what the generator produces. */
function drafted(index: number): Recommendation {
  return {
    id: `ai-tbilisi-p${index}`,
    name: `Place ${index}`,
    destination: "Tbilisi",
    tag: "hidden_gem",
    category: "sight",
    priceBand: "unknown",
    durationMinutes: 60,
    coords: { lat: 41.69 + index * 0.001, lng: 44.8 },
    interests: ["local_life"],
    timeWindow: { start: "10:00", end: "18:00" },
    vibe: "quiet",
    description: "",
    whyItFits: {},
    evidenceSource: "openstreetmap+ai",
    verified: false,
    priority: index + 1,
  } as Recommendation;
}

const prefs: TripPrefs = {
  destination: "Tbilisi",
  startDate: "2026-10-01",
  endDate: "2026-10-02",
  travellerType: "couple",
  interests: ["local_life"],
  dial: "insider",
  pace: "balanced",
  budgetPerDay: 0,
  budgetCurrency: "EUR",
  notes: "",
};

describe("transforms on a drafted trip", () => {
  const pool = Array.from({ length: 8 }, (_, i) => drafted(i));
  const trip = buildTrip(pool, prefs);

  it("never claims unpriced places are free", () => {
    const { summary } = makeCheaper(trip, pool);
    expect(summary.toLowerCase()).not.toContain("free");
    expect(summary).toContain("prices");
  });

  it("speaks about the traveller's destination, not a hardcoded city", () => {
    const { summary } = makeMoreLocal(trip, pool);
    expect(summary).not.toContain("Pune");
  });
});
