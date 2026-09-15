import { describe, expect, it } from "vitest";
import { matchHoursDefault } from "./hours-defaults";
import { describeHours, nextOpenStart, parseOpeningHours } from "./opening-hours";
import { buildTrip, scheduleDay, tripNotes } from "./trip-engine";
import type { ItineraryItem, Recommendation, TripPrefs } from "./types";

describe("reading opening_hours", () => {
  it.each([
    ["Mo-Su 09:00-22:00", "Open daily 9 AM – 10 PM"],
    ["Mo-Su,PH 09:00-22:00; PH off", "Open daily 9 AM – 10 PM"],
    ["24/7", "Open 24 hours"],
    ["Mo-Fr 09:00-17:00; Sa 10:00-14:00", "Mon–Fri 9 AM – 5 PM · Sat 10 AM – 2 PM · closed Sun"],
    ["06:00-12:00,16:00-21:00", "Open daily 6 AM – 12 PM, 4 PM – 9 PM"],
    ["Tu-Su 10:30-18:00", "Tue–Sun 10:30 AM – 6 PM · closed Mon"],
  ])("%s → %s", (raw, text) => {
    expect(describeHours(parseOpeningHours(raw)!)).toBe(text);
  });

  it.each([["Mo-Su,PH 09:00-22:00; off"], ["Mo-Fr 08:00-18:00; Jan off"], ["sunrise-sunset"], ['Mo-Fr 09:00-17:00 "by appointment"'], ["whenever"]])(
    "refuses to guess at %s",
    (raw) => {
      expect(parseOpeningHours(raw)).toBeNull();
    },
  );

  it("finds the next slot that fits a whole visit", () => {
    const hours = parseOpeningHours("Mo-Su 06:00-12:00,16:00-21:00")!;
    expect(nextOpenStart(hours, 2, 9 * 60, 60)).toBe(9 * 60);
    expect(nextOpenStart(hours, 2, 11 * 60 + 30, 60)).toBe(16 * 60);
    expect(nextOpenStart(hours, 2, 20 * 60 + 30, 60)).toBeNull();
  });
});

describe("regional defaults", () => {
  it("applies the midday rule to Hindu temples in Tamil Nadu only", () => {
    expect(matchHoursDefault({ religion: "hindu", category: "temple", region: "Tamil Nadu", countryCode: "IN" })?.id).toBe("south-india-hindu-temple");
    expect(matchHoursDefault({ category: "temple", region: "Kerala", countryCode: "IN" })?.id).toBe("south-india-hindu-temple");
    expect(matchHoursDefault({ religion: "hindu", category: "temple", region: "Maharashtra", countryCode: "IN" })).toBeUndefined();
    expect(matchHoursDefault({ religion: "christian", category: "church", region: "Tamil Nadu", countryCode: "IN" })).toBeUndefined();
    expect(matchHoursDefault({ religion: "hindu", category: "temple", region: null, countryCode: "IN" })).toBeUndefined();
  });
});

const place = (id: string, category: Recommendation["category"], start: string, extra: Partial<Recommendation> = {}): Recommendation => ({
  id,
  name: id,
  destination: "Kumbakonam",
  tag: "small_local",
  category,
  priceBand: "unknown",
  durationMinutes: 60,
  coords: { lat: 10.96, lng: 79.38 },
  interests: category === "cafe" ? ["cafes"] : ["spiritual"],
  timeWindow: { start, end: `${String(Number(start.slice(0, 2)) + 1).padStart(2, "0")}:00` },
  vibe: "",
  description: "",
  whyItFits: {},
  evidenceSource: "test",
  verified: false,
  priority: 1,
  facts: category === "cafe" ? { amenity: "cafe" } : { amenity: "place_of_worship", religion: "hindu" },
  ...extra,
});

const item = (p: Recommendation): ItineraryItem => ({ itemId: p.id, place: p, startMinutes: 0, durationMinutes: p.durationMinutes });
const TUESDAY = "2026-10-06";

describe("scheduling around closed hours", () => {
  it("waits for a Tamil Nadu temple with no listed hours to reopen after midday", () => {
    const [scheduled] = scheduleDay([item(place("temple", "temple", "13:30", { hoursRule: "south-india-hindu-temple" }))], TUESDAY);
    expect(scheduled.startMinutes).toBe(16 * 60);
    expect(scheduled.offPreferredWindow).toBe(false);
  });

  it("trusts a temple's own listed hours over the regional rule", () => {
    const [scheduled] = scheduleDay([item(place("open-all-day", "temple", "14:00", { openingHours: "Mo-Su 06:00-22:00", hoursRule: "south-india-hindu-temple" }))], TUESDAY);
    expect(scheduled.startMinutes).toBe(14 * 60);
  });

  it("warns when a place has no open slot left that day", () => {
    const [scheduled] = scheduleDay([item(place("late", "temple", "21:00", { openingHours: "Mo-Su 06:00-12:00" }))], TUESDAY);
    expect(scheduled.closedWarning).toBe(true);
  });

  it("never schedules a Tamil Nadu temple between 12:30 and 16:00, and puts cafés in the gap", () => {
    const prefs: TripPrefs = {
      destination: "Kumbakonam",
      startDate: TUESDAY,
      endDate: TUESDAY,
      travellerType: "family",
      interests: ["spiritual", "cafes"],
      dial: "local",
      pace: "packed",
      budgetPerDay: 0,
      budgetCurrency: "INR",
      notes: "",
    };
    const pool = [
      place("t1", "temple", "09:00", { hoursRule: "south-india-hindu-temple", coords: { lat: 10.961, lng: 79.38 } }),
      place("t2", "temple", "13:00", { hoursRule: "south-india-hindu-temple", coords: { lat: 10.962, lng: 79.38 } }),
      place("t3", "worship", "15:00", { hoursRule: "south-india-hindu-temple", coords: { lat: 10.963, lng: 79.38 } }),
      place("c1", "cafe", "13:00"),
    ];
    const trip = buildTrip(pool, prefs);
    const temples = trip.days[0].items.filter((i) => i.place.hoursRule);
    for (const temple of temples) {
      const start = temple.startMinutes;
      const end = start + temple.durationMinutes;
      expect(end <= 12 * 60 || start >= 16 * 60).toBe(true);
    }
    const cafe = trip.days[0].items.find((i) => i.place.category === "cafe")!;
    expect(cafe.startMinutes).toBeGreaterThanOrEqual(12 * 60);
    expect(cafe.startMinutes).toBeLessThan(16 * 60);
    expect(tripNotes(trip).join(" ")).not.toMatch(/Mo-Su/);
  });
});
