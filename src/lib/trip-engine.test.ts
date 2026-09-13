import { describe, expect, it } from "vitest";
import {
  addPlace,
  addSimilar,
  buildTrip,
  makeCheaper,
  makeMoreLocal,
  placeItem,
  rainyDaySwap,
  shiftItem,
} from "./trip-engine";
import type { Category, Recommendation, TripPrefs } from "./types";

const hour = (h: number) => `${String(h).padStart(2, "0")}:00`;
/** One-hour windows: the engine never puts overlapping windows on the same day. */
const oneHourAfter = (time: string) => hour(Number(time.slice(0, 2)) + 1);

/** A drafted place: real name, no pricing source — exactly what the generator produces. */
function drafted(index: number, category: Category = "sight", start = hour(8 + (index % 10))): Recommendation {
  return {
    id: `ai-tbilisi-p${index}`,
    name: `Place ${index}`,
    destination: "Tbilisi",
    tag: "hidden_gem",
    category,
    priceBand: "unknown",
    durationMinutes: 60,
    coords: { lat: 41.69 + index * 0.001, lng: 44.8 },
    interests: ["local_life"],
    timeWindow: { start, end: oneHourAfter(start) },
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

const names = (items: { place: Recommendation }[]) => items.map((i) => i.place.name);

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

describe("ordering", () => {
  const pool = [drafted(0, "sight", "09:00"), drafted(1, "museum", "11:00"), drafted(2, "cafe", "15:00")];
  const trip = buildTrip(pool, { ...prefs, endDate: prefs.startDate });

  it("keeps a dragged order instead of re-sorting by preferred time", () => {
    const [first, , third] = trip.days[0].items;
    const moved = placeItem(trip, third.itemId, 0, 0);
    expect(names(moved.days[0].items)).toEqual(["Place 2", "Place 0", "Place 1"]);
    // Re-scheduling keeps the order and still lays times out forwards.
    const starts = moved.days[0].items.map((i) => i.startMinutes);
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
    expect(moved.days[0].items[1].itemId).toBe(first.itemId);
  });

  it("nudges a stop one place later", () => {
    const first = trip.days[0].items[0];
    const shifted = shiftItem(trip, first.itemId, 1);
    expect(names(shifted.days[0].items)).toEqual(["Place 1", "Place 0", "Place 2"]);
  });

  it("slots an added place in by its preferred window", () => {
    const added = addPlace(trip, drafted(9, "food", "12:00"), 0);
    expect(names(added.days[0].items)).toEqual(["Place 0", "Place 1", "Place 9", "Place 2"]);
  });
});

describe("more like this and rainy days", () => {
  it("adds a same-category place right after the one the traveller liked", () => {
    const pool = [drafted(0, "museum"), drafted(1, "cafe"), drafted(2, "museum")];
    const trip = buildTrip(pool.slice(0, 2), { ...prefs, endDate: prefs.startDate });
    const museum = trip.days[0].items.find((i) => i.place.category === "museum")!;
    const { trip: next, summary } = addSimilar(trip, pool, museum.itemId);
    const list = names(next.days[0].items);
    expect(list[list.indexOf("Place 0") + 1]).toBe("Place 2");
    expect(summary).toContain("Place 2");
  });

  it("swaps outdoor stops for indoor ones only on rainy days", () => {
    const pool = [drafted(0, "outdoors"), drafted(1, "museum"), drafted(2, "cafe")];
    const trip = buildTrip([pool[0]], { ...prefs, endDate: prefs.startDate });
    const dry = rainyDaySwap(trip, pool, []);
    expect(names(dry.trip.days[0].items)).toEqual(["Place 0"]);
    const wet = rainyDaySwap(trip, pool, [trip.days[0].date]);
    expect(wet.trip.days[0].items[0].place.category).not.toBe("outdoors");
  });

  it("lets learned taste bring in a category the traveller keeps asking for more of", () => {
    // A relaxed day holds three stops. Four sights outrank the museum on editorial priority alone.
    const pool = [drafted(0, "sight"), drafted(1, "sight"), drafted(2, "sight"), drafted(3, "sight"), drafted(4, "museum")];
    const day = { ...prefs, endDate: prefs.startDate, pace: "relaxed" as const };

    const neutral = buildTrip(pool, day);
    expect(neutral.days[0].items.map((i) => i.place.category)).not.toContain("museum");

    const lovesMuseums = buildTrip(pool, { ...day, taste: { likes: { museum: 3 }, dislikes: {} } });
    expect(lovesMuseums.days[0].items.map((i) => i.place.category)).toContain("museum");
  });
});
