import { describe, expect, it } from "vitest";
import { parseWhen, todayIso } from "./intent/dates";

/** Tuesday 15 September 2026, in India — the handoff's fixed clock. */
const clock = { now: new Date("2026-09-15T06:00:00Z"), timeZone: "Asia/Kolkata" };
const when = (text: string) => parseWhen(text, clock, { longWeekend: /long weekend/i.test(text) });

describe("relative dates", () => {
  it.each([
    ["Kyoto tomorrow", "2026-09-16", false],
    ["today", "2026-09-15", false],
    ["out tonight", "2026-09-15", false],
    ["the day after tomorrow", "2026-09-17", false],
    ["Tbilisi this weekend", "2026-09-19", true],
    ["next weekend", "2026-09-26", true],
    ["Hanoi next week", "2026-09-21", true],
    ["next month", "2026-10-01", true],
  ])("%s → %s", (text, start, guessed) => {
    const reading = when(text);
    expect(reading?.startDate).toBe(start);
    expect(reading?.guessed).toBe(guessed);
  });

  it("puts a long weekend next month on its first Friday, marked as a guess with its source", () => {
    const reading = when("A long weekend in Kumbakonam next month with my parents");
    expect(reading).toEqual({ startDate: "2026-10-02", endDate: null, guessed: true, matched: "next month" });
  });

  it("starts a bare weekend on the coming Saturday", () => {
    expect(when("Weekend in Pune")?.startDate).toBe("2026-09-19");
  });

  it("starts a bare long weekend on the coming Friday", () => {
    expect(when("Long weekend in Marrakesh")?.startDate).toBe("2026-09-18");
  });
});

describe("named months", () => {
  it.each([
    ["3 days in Kyoto in November", "2026-11-01"],
    ["December in Buenos Aires", "2026-12-01"],
    ["6 days in early March", "2027-03-01"],
    ["mid October", "2026-10-15"],
    ["mid-October", "2026-10-15"],
    ["late November", "2026-11-22"],
    ["in May", "2027-05-01"],
    ["in Sept", "2026-09-16"],
  ])("%s → %s, guessed", (text, start) => {
    const reading = when(text);
    expect(reading?.startDate).toBe(start);
    expect(reading?.guessed).toBe(true);
  });

  it("doesn't read the verb 'may' as a month", () => {
    expect(when("we may go to Goa")).toBeNull();
  });
});

describe("exact dates and ranges", () => {
  it.each([
    ["12–15 Oct", "2026-10-12", "2026-10-15"],
    ["12-15 October", "2026-10-12", "2026-10-15"],
    ["Oct 12 to 15", "2026-10-12", "2026-10-15"],
  ])("%s", (text, start, end) => {
    expect(when(text)).toMatchObject({ startDate: start, endDate: end, guessed: false });
  });

  it.each([
    ["3 October", "2026-10-03"],
    ["October 3rd", "2026-10-03"],
    ["on 2 Feb", "2027-02-02"],
  ])("%s", (text, start) => {
    expect(when(text)).toMatchObject({ startDate: start, endDate: null, guessed: false });
  });
});

describe("festivals", () => {
  it("reads Christmas and New Year, marked as guesses", () => {
    expect(when("Goa for Christmas")).toMatchObject({ startDate: "2026-12-24", guessed: true });
    expect(when("New Year in Lisbon")).toMatchObject({ startDate: "2026-12-30", guessed: true });
  });
});

describe("no time phrase", () => {
  it("returns nothing rather than defaulting to tomorrow", () => {
    expect(when("3 days in Goa")).toBeNull();
    expect(when("Paris")).toBeNull();
  });
});

describe("the traveller's own timezone", () => {
  it("uses the local date, not the server's", () => {
    // 20:00 UTC on the 15th is already the 16th in India.
    const late = { now: new Date("2026-09-15T20:00:00Z"), timeZone: "Asia/Kolkata" };
    expect(todayIso(late)).toBe("2026-09-16");
    expect(parseWhen("tomorrow", late)?.startDate).toBe("2026-09-17");
    expect(todayIso({ now: late.now, timeZone: "America/Mexico_City" })).toBe("2026-09-15");
  });
});
