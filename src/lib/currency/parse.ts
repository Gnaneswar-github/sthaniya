import { isKnownCurrency, SYMBOL_CURRENCY, type CurrencyCode } from "./catalog";
import type { BudgetPeriod, Money } from "./format";

export type ParsedBudget = {
  money: Money;
  period: BudgetPeriod;
  perPerson: boolean;
  /** Null when the traveller gave a bare number and we fell back to the display currency. */
  currencyFromText: CurrencyCode | null;
};

const AMOUNT = /(\d[\d,.\s]*)/;

function toNumber(raw: string): number | null {
  // "15 000", "15,000" and "15.000" all mean the same thing in different places; strip
  // separators and keep a decimal point only when it looks like one.
  const cleaned = raw.replace(/\s/g, "");
  const looksDecimal = /[.,]\d{1,2}$/.test(cleaned);
  const normalised = looksDecimal
    ? cleaned.replace(/[.,](?=.*[.,])/g, "").replace(",", ".")
    : cleaned.replace(/[.,]/g, "");
  const value = Number(normalised);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function currencyFrom(token: string | undefined): CurrencyCode | null {
  if (!token) return null;
  const key = token.trim().toLowerCase();
  if (SYMBOL_CURRENCY[key]) return SYMBOL_CURRENCY[key];
  const upper = token.trim().toUpperCase();
  return isKnownCurrency(upper) ? upper : null;
}

/**
 * Accepts what people type: "150", "$150", "150 USD", "₹5,000", "LKR 15000",
 * "about 200 dollars per person per day". Returns null rather than guessing at nonsense.
 */
export function parseBudget(input: string, fallbackCurrency: CurrencyCode): ParsedBudget | null {
  const text = input.trim();
  if (!text) return null;

  const amountMatch = text.match(AMOUNT);
  if (!amountMatch) return null;
  const amount = toNumber(amountMatch[1]);
  if (amount === null) return null;

  const before = text.slice(0, amountMatch.index ?? 0);
  const after = text.slice((amountMatch.index ?? 0) + amountMatch[1].length);

  const symbolBefore = before.match(/([₹$€£¥₺₫₩₾฿]|[A-Za-z]{2,8})\s*$/)?.[1];
  const symbolAfter = after.match(/^\s*([₹$€£¥₺₫₩₾฿]|[A-Za-z]{2,8})/)?.[1];

  const currencyFromText = currencyFrom(symbolBefore) ?? currencyFrom(symbolAfter);

  const perPerson = /\bper person|\beach\b|\bpp\b|\ba head\b/i.test(text);
  const period: BudgetPeriod = /\bper day|\ba day\b|\/\s*day|\bdaily\b|\bper night|\ba night\b/i.test(text)
    ? perPerson
      ? "person_day"
      : "day"
    : /\btotal\b|\bfor the (?:whole )?trip\b|\ball in\b/i.test(text)
      ? "trip"
      : "day";

  return {
    money: { amount, currency: currencyFromText ?? fallbackCurrency },
    period,
    perPerson,
    currencyFromText,
  };
}
