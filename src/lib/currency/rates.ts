import type { CurrencyCode } from "./catalog";
import { roundToCurrency, type Money } from "./format";

/**
 * Exchange rates come from a provider, never from a constant in this repo. A stale hardcoded
 * rate is worse than no conversion at all, because it looks authoritative.
 */
export interface ExchangeRateProvider {
  readonly name: string;
  /** Rates expressed as 1 base → n quote. Currencies it can't cover are simply absent. */
  getRates(base: CurrencyCode, quotes: CurrencyCode[]): Promise<Record<CurrencyCode, number>>;
}

/** The honest default when nothing is configured: no rates, so the UI offers no conversion. */
export class NullRateProvider implements ExchangeRateProvider {
  readonly name = "none";
  async getRates(): Promise<Record<CurrencyCode, number>> {
    return {};
  }
}

/**
 * Frankfurter publishes European Central Bank reference rates. Free, keyless and genuinely
 * sourced — but the ECB set is limited, so currencies like LKR and AED come back missing and
 * we show "conversion unavailable" rather than approximating.
 */
export class FrankfurterRateProvider implements ExchangeRateProvider {
  readonly name = "frankfurter";

  async getRates(base: CurrencyCode, quotes: CurrencyCode[]): Promise<Record<CurrencyCode, number>> {
    const wanted = quotes.filter((q) => q.toUpperCase() !== base.toUpperCase());
    if (wanted.length === 0) return {};

    const params = new URLSearchParams({ from: base.toUpperCase(), to: wanted.join(",") });
    const response = await fetch(`https://api.frankfurter.app/latest?${params}`, {
      next: { revalidate: 21_600 },
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) throw new Error(`Frankfurter responded ${response.status}`);

    const data = (await response.json()) as { rates?: Record<string, number> };
    return data.rates ?? {};
  }
}

export function convert(money: Money, to: CurrencyCode, rate: number): Money {
  return { amount: roundToCurrency(money.amount * rate, to), currency: to.toUpperCase() };
}

export const rateProvider: ExchangeRateProvider =
  process.env.NEXT_PUBLIC_ENABLE_FX === "false" ? new NullRateProvider() : new FrankfurterRateProvider();
