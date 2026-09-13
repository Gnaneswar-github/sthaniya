import { COUNTRY_CURRENCY, isKnownCurrency, type CurrencyCode } from "./catalog";

export const CURRENCY_STORAGE_KEY = "sthaniya.currency";

export type CurrencySource = "saved" | "locale" | "region" | "fallback";

export type DetectedCurrency = { code: CurrencyCode; source: CurrencySource };

const FALLBACK: CurrencyCode = "USD";

function fromRegion(region: string | undefined): CurrencyCode | null {
  if (!region) return null;
  return COUNTRY_CURRENCY[region.toUpperCase()] ?? null;
}

/**
 * Resolution order: an explicit choice the traveller made, then their browser locale, then
 * the region the runtime reports, then USD.
 *
 * This deliberately says nothing about where they're travelling to. Someone in Colombo
 * planning Tokyo keeps seeing LKR until they say otherwise — display currency and
 * destination are unrelated concepts and conflating them is a classic travel-app annoyance.
 */
export function detectCurrency(saved?: string | null): DetectedCurrency {
  if (saved && isKnownCurrency(saved)) return { code: saved.toUpperCase(), source: "saved" };

  if (typeof navigator !== "undefined") {
    for (const tag of navigator.languages ?? [navigator.language]) {
      if (!tag) continue;
      try {
        const region = new Intl.Locale(tag).maximize().region;
        const code = fromRegion(region);
        if (code) return { code, source: "locale" };
      } catch {
        // A malformed language tag shouldn't stop us trying the next one.
      }
    }
  }

  try {
    const region = new Intl.Locale(Intl.DateTimeFormat().resolvedOptions().locale).maximize().region;
    const code = fromRegion(region);
    if (code) return { code, source: "region" };
  } catch {
    // Fall through.
  }

  return { code: FALLBACK, source: "fallback" };
}

export function readSavedCurrency(): string | null {
  try {
    return window.localStorage.getItem(CURRENCY_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function saveCurrency(code: CurrencyCode): void {
  try {
    window.localStorage.setItem(CURRENCY_STORAGE_KEY, code);
  } catch {
    // Blocked storage just means the choice won't survive a reload.
  }
}
