"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CURRENCIES, useCurrency } from "./CurrencyProvider";
import { getCurrency, type CurrencyCode } from "@/lib/currency/catalog";
import { formatMoney, type BudgetPeriod, type Money } from "@/lib/currency/format";
import { parseBudget } from "@/lib/currency/parse";

/** Renders an amount in its own currency, with a conversion only when one truly exists. */
export function Amount({
  money,
  showConversion = false,
  className,
}: {
  money: Money;
  showConversion?: boolean;
  className?: string;
}) {
  const { convert, currency, ratesReady } = useCurrency();
  const converted = showConversion && money.currency !== currency ? convert(money) : null;

  return (
    <span className={className}>
      {formatMoney(money)}
      {showConversion && money.currency !== currency && (
        <span className="text-ink-faint">
          {converted
            ? ` ≈ ${formatMoney(converted)}`
            : ratesReady
              ? " · no rate available"
              : " · converting…"}
        </span>
      )}
    </span>
  );
}

export function CurrencySelector({
  compact = false,
  onHero = false,
}: {
  compact?: boolean;
  onHero?: boolean;
}) {
  const { currency, setCurrency, source } = useCurrency();
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition ${
          onHero
            ? "text-white/80 ring-1 ring-white/25 hover:bg-white/10 hover:text-white"
            : "text-ink-soft ring-1 ring-line hover:text-brand"
        }`}
      >
        <GlobeIcon />
        {getCurrency(currency)?.symbol ?? currency} {!compact && currency}
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-1 w-60 overflow-hidden rounded-xl border border-line bg-paper-raised shadow-[0_18px_40px_-24px_rgba(32,27,23,0.6)]">
          <p className="border-b border-line px-3 py-2 text-[11px] text-ink-faint">
            {source === "saved"
              ? "Your saved currency"
              : source === "fallback"
                ? "Defaulted — we couldn't read your region"
                : "Detected from your device"}
          </p>
          <ul role="listbox" className="max-h-72 overflow-y-auto py-1">
            {CURRENCIES.map((option) => (
              <li key={option.code}>
                <button
                  type="button"
                  role="option"
                  aria-selected={option.code === currency}
                  onClick={() => {
                    setCurrency(option.code);
                    setOpen(false);
                  }}
                  className={`flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left text-sm transition hover:bg-paper ${
                    option.code === currency ? "text-brand" : "text-ink"
                  }`}
                >
                  <span>
                    {option.code} <span className="text-ink-faint">{option.name}</span>
                  </span>
                  <span className="text-ink-faint">{option.symbol}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * Free-text budget field. The traveller can type "150", "$150", "150 USD" or "LKR 15000" and
 * we normalise it, echoing back what we read so a misparse is visible rather than silent.
 */
export function CurrencyInput({
  value,
  onChange,
  label = "Budget per day",
  describe = true,
}: {
  value: Money | null;
  onChange: (money: Money, period: BudgetPeriod) => void;
  label?: string;
  /** Off when the parent explains the reading itself (total vs per day, per person). */
  describe?: boolean;
}) {
  const { currency } = useCurrency();
  const inputId = useId();
  const [text, setText] = useState(() => (value ? String(value.amount) : ""));
  const parsed = parseBudget(text, value?.currency ?? currency);

  function commit(next: string) {
    setText(next);
    const result = parseBudget(next, value?.currency ?? currency);
    if (result) onChange(result.money, result.period);
  }

  return (
    <div className="space-y-1.5">
      {label ? (
        <label htmlFor={inputId} className="text-sm font-semibold text-ink">
          {label}
        </label>
      ) : null}
      <input
        id={inputId}
        value={text}
        inputMode="text"
        onChange={(event) => commit(event.target.value)}
        placeholder={`${getCurrency(currency)?.symbol ?? ""}150, 150 USD, LKR 15000…`}
        className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-[15px] text-ink outline-none placeholder:text-ink-faint/60 focus:border-brand"
      />
      {describe ? (
        <p className="text-xs text-ink-faint">
          {text.trim() === "" ? (
            "Leave blank if you'd rather not set one."
          ) : parsed ? (
            <>
              Read as{" "}
              <span className="text-moss">
                {formatMoney(parsed.money)}
                {parsed.period === "trip" ? " for the trip" : parsed.period === "person_day" ? " per person / day" : " / day"}
              </span>
              {!parsed.currencyFromText && ` — assuming ${parsed.money.currency}, change it above if not`}
            </>
          ) : (
            <span className="text-gold">We couldn&rsquo;t read a number in that.</span>
          )}
        </p>
      ) : (
        text.trim() !== "" && !parsed && <p className="text-xs text-gold">We couldn&rsquo;t read a number in that.</p>
      )}
    </div>
  );
}

function GlobeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.4 2.5 3.6 5.5 3.6 9s-1.2 6.5-3.6 9c-2.4-2.5-3.6-5.5-3.6-9S9.6 5.5 12 3Z" />
    </svg>
  );
}

export type { CurrencyCode };
