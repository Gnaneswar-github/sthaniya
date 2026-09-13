import { describe, expect, it } from "vitest";
import { dayDirectionsUrl, tripToIcs, tripToText } from "./export";
import { decodeTrip, encodeTrip } from "./share";
import { buildTrip } from "./trip-engine";
import type { Recommendation, TripPrefs } from "./types";

const place = (i: number, name = `Stop ${i}`): Recommendation =>
  ({
    id: `p${i}`,
    name,
    destination: "Lisbon",
    tag: "local_favourite",
    category: "sight",
    priceBand: "unknown",
    durationMinutes: 60,
    coords: { lat: 38.71 + i / 1000, lng: -9.14 },
    interests: ["local_life"],
    // One-hour windows: overlapping windows would never share a day.
    timeWindow: { start: `${String(9 + i).padStart(2, "0")}:00`, end: `${String(10 + i).padStart(2, "0")}:00` },
    vibe: "Tiled, sunny, quiet",
    description: "",
    whyItFits: {},
    evidenceSource: "test",
    verified: false,
    priority: i + 1,
  }) as Recommendation;

const prefs: TripPrefs = {
  destination: "Lisbon",
  startDate: "2026-11-02",
  endDate: "2026-11-02",
  travellerType: "solo",
  interests: ["local_life"],
  dial: "local",
  pace: "balanced",
  budgetPerDay: 0,
  budgetCurrency: "EUR",
  notes: "",
};

const pool = [place(0, "Miradouro, da Graça; Lisbon"), place(1), place(2)];
const trip = buildTrip(pool, prefs);

describe("tripToIcs", () => {
  const ics = tripToIcs(trip);

  it("writes one event per stop with CRLF line endings", () => {
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(trip.days[0].items.length);
    expect(ics).toContain("DTSTART:20261102T");
  });

  it("escapes commas and semicolons in place names", () => {
    expect(ics).toContain("SUMMARY:Miradouro\\, da Graça\\; Lisbon");
  });

  it("folds long lines", () => {
    expect(ics.split("\r\n").every((line) => line.length <= 75)).toBe(true);
  });
});

describe("dayDirectionsUrl", () => {
  it("routes through the day's stops in order, on foot", () => {
    const url = new URL(dayDirectionsUrl(trip.days[0].items)!);
    expect(url.pathname).toBe("/maps/dir/");
    expect(url.searchParams.get("travelmode")).toBe("walking");
    expect(url.searchParams.get("origin")).toBe("38.71,-9.14");
    expect(url.searchParams.get("waypoints")?.split("|")).toHaveLength(trip.days[0].items.length - 2);
  });

  it("returns nothing for an empty day", () => {
    expect(dayDirectionsUrl([])).toBeNull();
  });
});

describe("tripToText", () => {
  it("lists every stop by day", () => {
    const text = tripToText(trip);
    expect(text).toContain("Lisbon — 1 day");
    expect(text).toContain("Stop 1");
  });
});

describe("share links", () => {
  it("round-trips a trip through the compressed fragment", async () => {
    const encoded = await encodeTrip(trip, pool);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    const decoded = await decodeTrip(encoded);
    expect(decoded?.trip.days[0].items.map((i) => i.place.name)).toEqual(trip.days[0].items.map((i) => i.place.name));
  });

  it("rejects a tampered link instead of throwing", async () => {
    expect(await decodeTrip("not-a-real-trip")).toBeNull();
  });
});
