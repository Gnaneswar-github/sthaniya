"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { CURRENCIES, type CurrencyCode } from "@/lib/currency/catalog";
import { detectCurrency, readSavedCurrency, saveCurrency } from "@/lib/currency/detect";
import { formatMoney, roundToCurrency, type Money } from "@/lib/currency/format";

type Rates = Record<CurrencyCode, number>;

type CurrencyContextValue = {
  currency: CurrencyCode;
  setCurrency: (code: CurrencyCode) => void;
  /** How we arrived at the current currency — surfaced so the choice never feels arbitrary. */
  source: "saved" | "locale" | "region" | "fallback";
  format: (money: Money) => string;
  /**
   * Converts into the display currency. Returns null when no rate is available, which the UI
   * must render as "no conversion" rather than as an approximation.
   */
  convert: (money: Money) => Money | null;
  ratesReady: boolean;
};

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  // Server and first client render must agree, so detection happens after mount.
  const [currency, setCurrencyState] = useState<CurrencyCode>("USD");
  const [source, setSource] = useState<CurrencyContextValue["source"]>("fallback");
  // Rates are stored with the base they were fetched for, so readiness is derived rather
  // than tracked with a second piece of state that has to be reset on every change.
  const [rateSet, setRateSet] = useState<{ base: CurrencyCode; rates: Rates } | null>(null);

  useEffect(() => {
    // Detection must happen after mount: the server has no locale to read.
    Promise.resolve().then(() => {
      const detected = detectCurrency(readSavedCurrency());
      setCurrencyState(detected.code);
      setSource(detected.source);
    });
  }, []);

  // Rates are fetched from a provider, never hardcoded. Failure leaves conversion unavailable.
  useEffect(() => {
    let live = true;

    fetch(`/api/rates?base=${encodeURIComponent(currency)}`)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("rates"))))
      .then((data: { rates?: Rates }) => {
        if (live) setRateSet({ base: currency, rates: data.rates ?? {} });
      })
      .catch(() => {
        if (live) setRateSet({ base: currency, rates: {} });
      });

    return () => {
      live = false;
    };
  }, [currency]);

  const setCurrency = useCallback((code: CurrencyCode) => {
    setCurrencyState(code);
    setSource("saved");
    saveCurrency(code);
  }, []);

  const value = useMemo<CurrencyContextValue>(() => {
    const ready = rateSet?.base === currency;
    const table = ready ? rateSet.rates : {};

    const convert = (money: Money): Money | null => {
      const from = money.currency.toUpperCase();
      const to = currency.toUpperCase();
      if (from === to) return money;

      // Rates are quoted from the display currency, so we invert to come back the other way.
      const rate = table[from];
      if (!rate || !Number.isFinite(rate) || rate === 0) return null;
      return { amount: roundToCurrency(money.amount / rate, to), currency: to };
    };

    return {
      currency,
      setCurrency,
      source,
      format: (money) => formatMoney(money),
      convert,
      ratesReady: ready,
    };
  }, [currency, rateSet, setCurrency, source]);

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency(): CurrencyContextValue {
  const context = useContext(CurrencyContext);
  if (!context) throw new Error("useCurrency must be used inside CurrencyProvider");
  return context;
}

export { CURRENCIES };
