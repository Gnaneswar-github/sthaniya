import { afterAll, describe, expect, it } from "vitest";
import { prefsFromIntent } from "./intent/prefs";
import { parseIntent } from "./parse-intent";
import { seasonFor } from "./season";

/**
 * HANDOFF Section 5: the regression briefs, read with the fixed clock (Tue 15 Sept 2026, Asia/Kolkata).
 * Each row checks only what the parser and preferences can know; plan-level checks live in the
 * trip-engine tests. A printed table of actual vs expected follows the run.
 */

const clock = { now: new Date("2026-09-15T06:00:00Z"), timeZone: "Asia/Kolkata" };

type Expected = {
  destination?: string;
  start?: string;
  datesGuessed?: boolean;
  noDates?: boolean;
  days?: number;
  type?: string;
  adults?: number;
  children?: number;
  partyGuessed?: boolean;
  interests?: string[];
  pace?: string;
  paceGuessed?: boolean;
  mobility?: string;
  budget?: { amount: number; currency: string; basis: string; perPerson: boolean };
  budgetBasisGuessed?: boolean;
  perDay?: number;
  avoid?: string;
  dial?: string;
  legs?: string[];
  season?: { lat: number; value: string };
};

const BRIEFS: { n: number; text: string; expect: Expected }[] = [
  {
    n: 1,
    text: "A long weekend in Kumbakonam next month with my parents who can't walk much. We love temples and filter coffee, want to avoid crowds, around 15000 rupees total.",
    expect: { destination: "Kumbakonam", start: "2026-10-02", datesGuessed: true, days: 3, type: "family", adults: 3, children: 0, partyGuessed: true, interests: ["spiritual", "cafes"], pace: "relaxed", paceGuessed: true, mobility: "limited", budget: { amount: 15000, currency: "INR", basis: "total", perPerson: false }, perDay: 5000, avoid: "crowds" },
  },
  {
    n: 2,
    text: "3 days in Kyoto in November with my wife, love gardens, hate queues",
    expect: { destination: "Kyoto", start: "2026-11-01", datesGuessed: true, days: 3, type: "couple", adults: 2, interests: ["nature"], avoid: "queues", season: { lat: 35.01, value: "autumn" } },
  },
  { n: 3, text: "A week in Lisbon solo, €80 a day", expect: { destination: "Lisbon", days: 7, type: "solo", adults: 1, budget: { amount: 80, currency: "EUR", basis: "per_day", perPerson: false }, perDay: 80, datesGuessed: true } },
  {
    n: 4,
    text: "Weekend in Pune with two kids under 5, we'll have a stroller",
    expect: { destination: "Pune", start: "2026-09-19", datesGuessed: true, days: 2, type: "family", adults: 2, children: 2, partyGuessed: true, mobility: "pram" },
  },
  { n: 5, text: "Hanoi next week, 5 days, $500 all in, street food", expect: { destination: "Hanoi", start: "2026-09-21", datesGuessed: true, days: 5, budget: { amount: 500, currency: "USD", basis: "total", perPerson: false }, perDay: 100, interests: ["food"] } },
  { n: 6, text: "December in Buenos Aires, 4 days", expect: { destination: "Buenos Aires", start: "2026-12-01", datesGuessed: true, days: 4, season: { lat: -34.6, value: "summer" } } },
  { n: 7, text: "Mexico City for 2 days, my dad uses a wheelchair", expect: { destination: "Mexico City", days: 2, type: "family", adults: 2, partyGuessed: true, mobility: "wheelchair" } },
  { n: 8, text: "Tokyo for 10 days, ¥20,000 per day, anime and food", expect: { destination: "Tokyo", days: 10, budget: { amount: 20000, currency: "JPY", basis: "per_day", perPerson: false }, interests: ["food"] } },
  {
    n: 9,
    text: "Long weekend in Marrakesh with friends, 5 of us, 2000 dirhams each",
    expect: { destination: "Marrakesh", days: 3, type: "friends", adults: 5, budget: { amount: 2000, currency: "MAD", basis: "total", perPerson: true }, budgetBasisGuessed: true },
  },
  { n: 10, text: "Istanbul in 3 days, avoid touristy stuff, love bookshops", expect: { destination: "Istanbul", days: 3, dial: "insider", avoid: "touristy stuff" } },
  { n: 11, text: "Kyoto tomorrow, just one day", expect: { destination: "Kyoto", start: "2026-09-16", datesGuessed: false, days: 1 } },
  { n: 12, text: "Tbilisi this weekend", expect: { destination: "Tbilisi", start: "2026-09-19", datesGuessed: true, days: 2 } },
  { n: 13, text: "Oaxaca, 6 days in early March, slow pace, mezcal", expect: { destination: "Oaxaca City", start: "2027-03-01", datesGuessed: true, days: 6, pace: "relaxed", paceGuessed: false } },
  { n: 14, text: "Penang for 4 days with my elderly mother, halal food please", expect: { destination: "George Town, Penang", days: 4, type: "family", adults: 2, partyGuessed: true, mobility: "limited", interests: ["food"] } },
  { n: 15, text: "Chennai to Kumbakonam to Thanjavur over 5 days", expect: { days: 5, legs: ["Chennai", "Kumbakonam", "Thanjavur"] } },
  { n: 16, text: "₹15,000 per person for 3 days in Goa", expect: { destination: "Goa", days: 3, budget: { amount: 15000, currency: "INR", basis: "total", perPerson: true }, budgetBasisGuessed: false } },
  { n: 17, text: "Two weeks in Japan", expect: { destination: "Japan", days: 14 } },
  { n: 18, text: "Paris", expect: { destination: "Paris", datesGuessed: true } },
  { n: 19, text: "Madurai 2 days, temples mattum", expect: { destination: "Madurai", days: 2, interests: ["spiritual"] } },
  { n: 20, text: "3 days in Kumbakonam, packed schedule, we walk a lot, ₹3000 a day", expect: { destination: "Kumbakonam", days: 3, pace: "packed", paceGuessed: false, mobility: "none", budget: { amount: 3000, currency: "INR", basis: "per_day", perPerson: false }, perDay: 3000 } },
];

const rows: { brief: number; field: string; expected: string; actual: string; ok: string }[] = [];
const show = (value: unknown) => (typeof value === "string" ? value : JSON.stringify(value));

describe("HANDOFF Section 5 regression briefs", () => {
  for (const brief of BRIEFS) {
    it(`brief ${brief.n}: ${brief.text}`, () => {
      const intent = parseIntent(brief.text, clock);
      const { prefs, guessed } = prefsFromIntent(intent, brief.text, "USD", clock);
      const days = Math.round((Date.parse(prefs.endDate) - Date.parse(prefs.startDate)) / 86_400_000) + 1;

      const actual: Record<keyof Expected, unknown> = {
        destination: prefs.legs ? undefined : prefs.destination,
        start: prefs.startDate,
        datesGuessed: guessed.dates,
        noDates: intent.dates === null,
        days,
        type: prefs.travellerType,
        adults: prefs.adults,
        children: prefs.children,
        partyGuessed: guessed.party,
        interests: prefs.interests,
        pace: prefs.pace,
        paceGuessed: guessed.pace,
        mobility: prefs.mobility,
        budget: prefs.budget,
        budgetBasisGuessed: guessed.budgetBasis,
        perDay: prefs.budgetPerDay,
        avoid: intent.avoid.join(" · "),
        dial: prefs.dial,
        legs: prefs.legs?.map((leg) => leg.destination),
        season: brief.expect.season ? { lat: brief.expect.season.lat, value: seasonFor(prefs.startDate, brief.expect.season.lat) } : undefined,
      };

      for (const [field, expected] of Object.entries(brief.expect) as [keyof Expected, unknown][]) {
        const value = actual[field];
        const ok =
          field === "interests"
            ? (expected as string[]).every((i) => (value as string[]).includes(i))
            : field === "avoid"
              ? String(value).includes(String(expected))
              : JSON.stringify(value) === JSON.stringify(expected);
        rows.push({ brief: brief.n, field, expected: show(expected), actual: show(value), ok: ok ? "✓" : "✗ MISMATCH" });
      }

      const failures = rows.filter((row) => row.brief === brief.n && row.ok !== "✓");
      expect(failures, JSON.stringify(failures)).toEqual([]);
    });
  }

  afterAll(() => {
    console.table(rows);
  });
});
