import { isKnownCurrency, SYMBOL_CURRENCY } from "../currency/catalog";
import { formatMoney, roundToCurrency } from "../currency/format";
import type { BudgetBasis } from "../types";

/**
 * A budget as the traveller said it: an amount, a currency if they named one, and whether it is
 * for the whole trip or per day, and per person. "Around 15000 rupees total" is ₹15,000 for the
 * trip — never ₹15,000 a day. The per-day figure the planner uses is derived in exactly one place.
 */

export type BudgetReading = {
  amount: number;
  /** Null when the sentence gave a number without a currency. */
  currency: string | null;
  basis: BudgetBasis;
  perPerson: boolean;
  /** True when no basis word was given and we chose one. */
  basisGuessed: boolean;
  matched: string;
};

export type Budget = { amount: number; currency: string; basis: BudgetBasis; perPerson: boolean };

/** Loose words and symbols beyond the catalog's own list. Language data, like destination aliases. */
const EXTRA_CURRENCY: Record<string, string> = {
  "rs.": "INR",
  inr: "INR",
  "a$": "AUD",
  "c$": "CAD",
  "s$": "SGD",
  "nz$": "NZD",
  "mx$": "MXN",
  "r$": "BRL",
  rm: "MYR",
  dh: "MAD",
  ringgit: "MYR",
  lira: "TRY",
  lari: "GEL",
  peso: "MXN",
  pesos: "MXN",
  dong: "VND",
  won: "KRW",
  yuan: "CNY",
  franc: "CHF",
  francs: "CHF",
  rand: "ZAR",
  bucks: "USD",
};

/** "Dirham" names two currencies; Moroccan places in the sentence decide which. */
const MOROCCO = /\b(?:morocco|moroccan|marrakesh|marrakech|fes|fez|casablanca|rabat|tangier|chefchaouen|essaouira|agadir|merzouga)\b/i;

const SYMBOL = "₹|\\$|€|£|¥|₺|₫|₩|₾|฿|rs\\.?|a\\$|c\\$|s\\$|nz\\$|mx\\$|r\\$|rm|dh";
const WORD = "rupees?|dollars?|bucks|euros?|pounds?|quid|yen|dirhams?|baht|rupiah|ringgit|lira|lari|pesos?|dong|won|yuan|francs?|rand";
const NUMBER = "(\\d{1,3}(?:[,.\\s]\\d{3})+|\\d+(?:\\.\\d{1,2})?)(?:\\s?(k|thousand|lakhs?))?";
const NOT_A_COUNT = "(?!\\s*(?:days?|nights?|weeks?|months?|people|persons|adults|kids|children|of us|km|kms|hours?|hrs?|years?|yrs?|am|pm|%|stars?|minutes?|mins?))";

const BEFORE = new RegExp(`(?<![\\p{L}\\d])(${SYMBOL}|[A-Z]{3})\\s?${NUMBER}`, "giu");
const AFTER = new RegExp(`${NUMBER}\\s?(${SYMBOL}|${WORD}|[A-Z]{3})(?![\\p{L}])`, "giu");
const KEYWORD = new RegExp(`\\b(?:budget(?:\\s+(?:of|is|around|about|roughly))?|spend(?:ing)?|around|about|roughly|approximately|up to|max(?:imum)?)\\s+${NUMBER}${NOT_A_COUNT}`, "giu");

const PER_DAY = /\b(?:per day|a day|each day|per night|a night|daily)\b|\/\s*day\b/i;
const TOTAL = /\b(?:total|in total|overall|all[- ]in|for the (?:whole |entire )?trip|for (?:the )?(?:\d+|two|three|four|five|six|seven|eight|nine|ten) (?:days|nights))\b/i;
const PER_PERSON = /\b(?:per person|per head|a head|per pax|pp|each(?!\s+(?:day|night)))\b/i;

function currencyOf(token: string, text: string): string | null {
  const key = token.toLowerCase();
  if (/^dirhams?$/.test(key)) return MOROCCO.test(text) ? "MAD" : "AED";
  const code = SYMBOL_CURRENCY[key] ?? EXTRA_CURRENCY[key] ?? SYMBOL_CURRENCY[key.replace(/s$/, "")];
  if (code) return code;
  if (/^[A-Z]{3}$/.test(token) && isKnownCurrency(token)) return token;
  return null;
}

function toAmount(digits: string, multiplier?: string): number {
  const grouped = /[,.\s]\d{3}(?!\d)/.test(digits) && !/\.\d{1,2}$/.test(digits);
  const value = grouped ? Number(digits.replace(/[,.\s]/g, "")) : Number(digits.replace(/,/g, ""));
  const m = multiplier?.toLowerCase();
  return value * (m === "k" || m === "thousand" ? 1000 : m?.startsWith("lakh") ? 100_000 : 1);
}

/** The clause around the amount, which is where "total", "a day" and "each" live. */
function clauseAround(text: string, start: number, end: number): string {
  const boundary = /[.;!?](?=\s|$)|,\s/g;
  let from = 0;
  let to = text.length;
  for (const match of text.matchAll(boundary)) {
    if (match.index! < start) from = match.index! + match[0].length;
    else if (match.index! >= end) {
      to = match.index!;
      break;
    }
  }
  return text.slice(from, to).trim();
}

export function readBudget(text: string, options: { days: number | null }): BudgetReading | null {
  type Hit = { index: number; end: number; amount: number; currency: string | null };
  const hits: Hit[] = [];

  for (const m of text.matchAll(BEFORE)) {
    const currency = currencyOf(m[1], text);
    if (currency) hits.push({ index: m.index!, end: m.index! + m[0].length, amount: toAmount(m[2], m[3]), currency });
  }
  for (const m of text.matchAll(AFTER)) {
    const currency = currencyOf(m[3], text);
    if (currency) hits.push({ index: m.index!, end: m.index! + m[0].length, amount: toAmount(m[1], m[2]), currency });
  }
  if (hits.length === 0) {
    for (const m of text.matchAll(KEYWORD)) hits.push({ index: m.index!, end: m.index! + m[0].length, amount: toAmount(m[1], m[2]), currency: null });
  }

  const hit = hits.filter((h) => Number.isFinite(h.amount) && h.amount > 0).sort((a, b) => a.index - b.index)[0];
  if (!hit) return null;

  const clause = clauseAround(text, hit.index, hit.end);
  const perDay = PER_DAY.test(clause);
  const total = !perDay && TOTAL.test(clause);
  const basisGuessed = !perDay && !total;
  // No basis word: for a trip of two days or more, an amount is far more often the whole budget.
  const basis: BudgetBasis = perDay ? "per_day" : total ? "total" : (options.days ?? 3) >= 2 ? "total" : "per_day";

  return { amount: hit.amount, currency: hit.currency, basis, perPerson: PER_PERSON.test(clause), basisGuessed, matched: clause };
}

/** The group's spend per day — the one figure the planner and the model use. */
export function perDayForGroup(budget: Pick<Budget, "amount" | "basis" | "perPerson">, days: number, people: number): number {
  const group = budget.perPerson ? budget.amount * Math.max(1, people) : budget.amount;
  return budget.basis === "total" ? group / Math.max(1, days) : group;
}

/** "₹15,000 total for 3 days ≈ ₹5,000 / day for the group". */
export function describeBudget(budget: Budget, days: number, people: number): string {
  const money = (amount: number) => formatMoney({ amount: roundToCurrency(Math.round(amount), budget.currency), currency: budget.currency }, { maximumFractionDigits: 0 });
  const d = Math.max(1, days);
  const n = Math.max(1, people);
  const dayWord = d === 1 ? "day" : "days";

  if (budget.basis === "per_day") {
    if (!budget.perPerson) return `${money(budget.amount)} per day`;
    return n > 1 ? `${money(budget.amount)} per person per day ≈ ${money(budget.amount * n)} / day for ${n} people` : `${money(budget.amount)} per person per day`;
  }
  if (budget.perPerson) {
    const each = `${money(budget.amount)} per person for ${d} ${dayWord} ≈ ${money(budget.amount / d)} per person / day`;
    return n > 1 ? `${each} · ${money(budget.amount * n)} total for ${n} people` : each;
  }
  return `${money(budget.amount)} total for ${d} ${dayWord} ≈ ${money(budget.amount / d)} / day for the group`;
}
