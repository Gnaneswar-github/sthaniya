import { describe, expect, it } from "vitest";
import { describeBudget, perDayForGroup, readBudget } from "./intent/budget";

describe("budget basis", () => {
  it("reads 'around 15000 rupees total' as the whole trip, not per day", () => {
    const budget = readBudget("want to avoid crowds, around 15000 rupees total.", { days: 3 });
    expect(budget).toMatchObject({ amount: 15000, currency: "INR", basis: "total", perPerson: false, basisGuessed: false });
    expect(perDayForGroup(budget!, 3, 3)).toBe(5000);
    expect(describeBudget({ ...budget!, currency: "INR" }, 3, 3)).toBe("₹15,000 total for 3 days ≈ ₹5,000 / day for the group");
  });

  it("reads '€80 a day' as per day", () => {
    const budget = readBudget("A week in Lisbon solo, €80 a day", { days: 7 });
    expect(budget).toMatchObject({ amount: 80, currency: "EUR", basis: "per_day", perPerson: false, basisGuessed: false });
    expect(perDayForGroup(budget!, 7, 1)).toBe(80);
    expect(describeBudget({ ...budget!, currency: "EUR" }, 7, 1)).toMatch(/80.*per day/);
  });

  it("reads '₹15,000 per person for 3 days' as per person, for the trip", () => {
    const budget = readBudget("₹15,000 per person for 3 days in Goa", { days: 3 });
    expect(budget).toMatchObject({ amount: 15000, currency: "INR", basis: "total", perPerson: true, basisGuessed: false });
    expect(perDayForGroup(budget!, 3, 2)).toBe(10000);
  });

  it("reads '$500 all in' over 5 days as $100 a day", () => {
    const budget = readBudget("Hanoi next week, 5 days, $500 all in, street food", { days: 5 });
    expect(budget).toMatchObject({ amount: 500, currency: "USD", basis: "total" });
    expect(perDayForGroup(budget!, 5, 1)).toBe(100);
  });

  it("reads '2000 dirhams each' in Marrakesh as Moroccan dirhams per person, guessing total", () => {
    const budget = readBudget("Long weekend in Marrakesh with friends, 5 of us, 2000 dirhams each", { days: 3 });
    expect(budget).toMatchObject({ amount: 2000, currency: "MAD", basis: "total", perPerson: true, basisGuessed: true });
  });

  it("reads dirhams elsewhere as UAE dirhams", () => {
    expect(readBudget("Dubai, 3 days, 900 dirhams a day", { days: 3 })?.currency).toBe("AED");
  });

  it.each([
    ["Tokyo for 10 days, ¥20,000 per day, anime and food", 20000, "JPY", "per_day"],
    ["3 days in Kumbakonam, packed schedule, we walk a lot, ₹3000 a day", 3000, "INR", "per_day"],
    ["about 15k rupees for the trip", 15000, "INR", "total"],
    ["USD 1,200 in total", 1200, "USD", "total"],
    ["Rs. 4000 daily", 4000, "INR", "per_day"],
  ])("%s", (text, amount, currency, basis) => {
    expect(readBudget(text, { days: 3 })).toMatchObject({ amount, currency, basis });
  });

  it("guesses total for a multi-day trip with no basis word, and per day for a single day", () => {
    expect(readBudget("Goa, budget 20000", { days: 3 })).toMatchObject({ basis: "total", basisGuessed: true, currency: null });
    expect(readBudget("Goa, budget 2000", { days: 1 })).toMatchObject({ basis: "per_day", basisGuessed: true });
  });

  it("never mistakes a count for money", () => {
    expect(readBudget("3 days in Goa", { days: 3 })).toBeNull();
    expect(readBudget("Weekend in Pune with two kids under 5, we'll have a stroller", { days: 2 })).toBeNull();
    expect(readBudget("around 4 days", { days: 4 })).toBeNull();
  });

  it("describes a per-person total for a group", () => {
    const text = describeBudget({ amount: 2000, currency: "MAD", basis: "total", perPerson: true }, 3, 5);
    expect(text).toContain("per person for 3 days");
    expect(text).toContain("total for 5 people");
  });
});
