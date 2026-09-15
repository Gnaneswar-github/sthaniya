import { getCurrency, type CurrencyCode } from "./catalog";

export type Money = { amount: number; currency: CurrencyCode };

/**
 * All formatting goes through Intl, which already knows that JPY has no minor unit and that
 * en-IN groups in lakhs. Hardcoding either would be a bug waiting to happen.
 */
export function formatMoney(
  money: Money,
  options: { locale?: string; compact?: boolean; maximumFractionDigits?: number } = {},
): string {
  const currency = getCurrency(money.currency);
  const locale = options.locale ?? currency?.locale ?? "en-US";

  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: money.currency.toUpperCase(),
      notation: options.compact ? "compact" : "standard",
      ...(options.maximumFractionDigits !== undefined
        ? { minimumFractionDigits: 0, maximumFractionDigits: options.maximumFractionDigits }
        : {}),
    }).format(money.amount);
  } catch {
    // An unknown or malformed code should degrade to something readable, not throw.
    return `${money.currency.toUpperCase()} ${money.amount.toLocaleString("en-US")}`;
  }
}

/** Rounds to the currency's own precision — ¥150.4 is not a number that exists. */
export function roundToCurrency(amount: number, code: CurrencyCode): number {
  let digits = 2;
  try {
    digits =
      new Intl.NumberFormat("en-US", { style: "currency", currency: code.toUpperCase() }).resolvedOptions()
        .maximumFractionDigits ?? 2;
  } catch {
    digits = 2;
  }
  const factor = 10 ** digits;
  return Math.round(amount * factor) / factor;
}

export type BudgetPeriod = "day" | "trip" | "person_day";

export function formatBudget(money: Money, period: BudgetPeriod, locale?: string): string {
  const value = formatMoney(money, { locale });
  if (period === "day") return `${value} / day`;
  if (period === "person_day") return `${value} per person / day`;
  return `${value} total`;
}
