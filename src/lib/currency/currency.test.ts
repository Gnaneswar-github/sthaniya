import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { COUNTRY_CURRENCY, getCurrency, isKnownCurrency } from "./catalog";
import { formatBudget, formatMoney, roundToCurrency } from "./format";
import { parseBudget } from "./parse";

/** Strips the non-breaking and narrow spaces Intl uses, so assertions stay readable. */
const flat = (value: string) => value.replace(/[  ]/g, " ");

describe("formatting", () => {
  it("uses each currency's own symbol and precision", () => {
    assert.equal(flat(formatMoney({ amount: 150, currency: "USD" })), "$150.00");
    assert.equal(flat(formatMoney({ amount: 150, currency: "GBP" })), "£150.00");
    assert.match(flat(formatMoney({ amount: 150, currency: "EUR" })), /150,00\s?€/);
  });

  it("gives JPY no decimals, because the yen has no minor unit", () => {
    const formatted = flat(formatMoney({ amount: 15000, currency: "JPY" }));
    assert.ok(!formatted.includes("."), `expected no decimal point in ${formatted}`);
    assert.ok(formatted.includes("15,000"), formatted);
  });

  it("groups INR in the Indian system", () => {
    // 1,00,000 rather than 100,000 — the whole reason INR carries its own locale.
    assert.ok(flat(formatMoney({ amount: 100000, currency: "INR" })).includes("1,00,000"));
  });

  it("formats LKR, AED and AUD without falling back to a raw code", () => {
    for (const currency of ["LKR", "AED", "AUD"]) {
      const formatted = flat(formatMoney({ amount: 1500, currency }));
      assert.ok(/\d/.test(formatted), `${currency} produced no digits: ${formatted}`);
      assert.ok(formatted.includes("1,500") || formatted.includes("1.500") || formatted.includes("١٬٥٠٠"), formatted);
    }
  });

  it("stays readable for a code we don't carry, instead of throwing", () => {
    // Intl accepts any well-formed code, so this usually formats rather than hitting our
    // fallback. Either way the contract is the same: a string with the code and the amount.
    const formatted = flat(formatMoney({ amount: 10, currency: "ZZZ" }));
    assert.ok(formatted.includes("ZZZ"), formatted);
    assert.ok(formatted.includes("10"), formatted);
  });

  it("throws nothing on a malformed code", () => {
    assert.doesNotThrow(() => formatMoney({ amount: 10, currency: "not-a-code" }));
    assert.ok(flat(formatMoney({ amount: 10, currency: "not-a-code" })).includes("10"));
  });

  it("rounds to the currency's real precision", () => {
    assert.equal(roundToCurrency(150.456, "USD"), 150.46);
    assert.equal(roundToCurrency(150.4, "JPY"), 150);
  });

  it("labels the budget period", () => {
    assert.equal(flat(formatBudget({ amount: 150, currency: "USD" }, "day")), "$150.00 / day");
    assert.equal(
      flat(formatBudget({ amount: 150, currency: "USD" }, "person_day")),
      "$150.00 per person / day",
    );
  });
});

describe("parsing free-text budgets", () => {
  it("reads a bare number using the display currency", () => {
    const parsed = parseBudget("150", "LKR");
    assert.equal(parsed?.money.amount, 150);
    assert.equal(parsed?.money.currency, "LKR");
    assert.equal(parsed?.currencyFromText, null);
  });

  it("reads a leading symbol", () => {
    assert.equal(parseBudget("$150", "INR")?.money.currency, "USD");
    assert.equal(parseBudget("₹5000", "USD")?.money.currency, "INR");
    assert.equal(parseBudget("£90", "USD")?.money.currency, "GBP");
  });

  it("reads a trailing or leading code", () => {
    assert.equal(parseBudget("150 USD", "INR")?.money.currency, "USD");
    assert.equal(parseBudget("LKR 15000", "USD")?.money.currency, "LKR");
    assert.equal(parseBudget("15000 LKR", "USD")?.money.amount, 15000);
    assert.equal(parseBudget("200 AED", "USD")?.money.currency, "AED");
  });

  it("reads currency words", () => {
    assert.equal(parseBudget("5000 rupees", "USD")?.money.currency, "INR");
    assert.equal(parseBudget("about 200 dollars per day", "INR")?.money.currency, "USD");
  });

  it("handles separators", () => {
    assert.equal(parseBudget("15,000 LKR", "USD")?.money.amount, 15000);
    assert.equal(parseBudget("15 000 JPY", "USD")?.money.amount, 15000);
    assert.equal(parseBudget("$1,250.50", "USD")?.money.amount, 1250.5);
  });

  it("detects the period and per-person framing", () => {
    assert.equal(parseBudget("$200 per day", "USD")?.period, "day");
    assert.equal(parseBudget("$200 per person per day", "USD")?.period, "person_day");
    assert.equal(parseBudget("$2000 total for the trip", "USD")?.period, "trip");
    assert.equal(parseBudget("$200 per person per day", "USD")?.perPerson, true);
  });

  it("returns null rather than guessing at nonsense", () => {
    assert.equal(parseBudget("", "USD"), null);
    assert.equal(parseBudget("cheap please", "USD"), null);
  });
});

describe("catalogue", () => {
  it("knows the currencies the product claims to support", () => {
    for (const code of ["INR", "LKR", "USD", "EUR", "GBP", "JPY", "AED", "AUD"]) {
      assert.ok(isKnownCurrency(code), `${code} missing from catalogue`);
      assert.ok(getCurrency(code)?.locale, `${code} has no locale`);
    }
  });

  it("maps the countries the product claims to support", () => {
    const expected: Record<string, string> = {
      IN: "INR", LK: "LKR", US: "USD", GB: "GBP", JP: "JPY",
      AU: "AUD", CA: "CAD", SG: "SGD", AE: "AED", FR: "EUR",
    };
    for (const [country, currency] of Object.entries(expected)) {
      assert.equal(COUNTRY_CURRENCY[country], currency, `${country} should map to ${currency}`);
    }
  });
});
