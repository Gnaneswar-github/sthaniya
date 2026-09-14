"use client";

import { CurrencyInput } from "./currency/CurrencyControls";
import { DestinationSelector } from "./DestinationSelector";
import { CloseIcon } from "./icons";
import { withLegs } from "@/lib/legs";
import {
  DIAL_POSITIONS,
  INTERESTS,
  PACES,
  TRAVELLER_TYPES,
  type DialPosition,
  type Interest,
  type Pace,
  type TravellerType,
  type TripPrefs,
} from "@/lib/types";

/**
 * Shows the machine's reading back to the traveller before anything is built, with the exact
 * phrase each value came from. Anything it guessed is marked as a guess, and every field is
 * one tap from being corrected — which is cheaper than getting the itinerary wrong.
 */
export function Understanding({
  prefs,
  readFrom,
  avoid,
  onChange,
}: {
  prefs: TripPrefs;
  readFrom: Partial<Record<keyof TripPrefs | "interests", string>>;
  avoid: string[];
  onChange: (next: TripPrefs) => void;
}) {
  const set = <K extends keyof TripPrefs>(key: K, value: TripPrefs[K]) =>
    onChange({ ...prefs, [key]: value });

  function toggleInterest(id: Interest) {
    const next = prefs.interests.includes(id)
      ? prefs.interests.filter((i) => i !== id)
      : [...prefs.interests, id];
    set("interests", next);
  }

  const nights = Math.max(
    1,
    Math.round((Date.parse(prefs.endDate) - Date.parse(prefs.startDate)) / 86_400_000) + 1,
  );
  const multiCity = Boolean(prefs.legs && prefs.legs.length > 1);

  return (
    <div className="space-y-6 rounded-3xl border border-line bg-paper-raised p-5 sm:p-7">
      {multiCity && prefs.legs ? (
        <Row label="Route" source={readFrom.destination} note={`${prefs.legs.length} cities`}>
          <LegsEditor prefs={prefs} onChange={onChange} />
        </Row>
      ) : (
        <Row label="Destination" source={readFrom.destination}>
          {prefs.destination && (
            <p className="mb-1.5 font-display text-2xl leading-tight text-ink">{prefs.destination}</p>
          )}
          <DestinationSelector
            placeholder={prefs.destination ? "Change destination" : "Search any city, country or island"}
            onSelect={(destination) => set("destination", destination.name)}
          />
          {prefs.destination && (
            <button
              type="button"
              onClick={() =>
                onChange(
                  withLegs(prefs, [
                    { destination: prefs.destination, days: nights },
                    { destination: "", days: 2 },
                  ]),
                )
              }
              className="mt-2 text-sm font-semibold text-brand hover:underline"
            >
              + Add another city
            </button>
          )}
        </Row>
      )}

      <Row label="Dates" source={readFrom.startDate} note={`${nights} ${nights === 1 ? "day" : "days"}`}>
        <div className="flex items-center gap-2">
          <input
            type="date"
            aria-label="First day"
            value={prefs.startDate}
            onChange={(event) =>
              onChange(
                multiCity
                  ? withLegs({ ...prefs, startDate: event.target.value }, prefs.legs)
                  : { ...prefs, startDate: event.target.value },
              )
            }
            className="min-w-0 flex-1 rounded-xl border border-line bg-paper px-3 py-2.5 text-sm text-ink outline-none focus:border-brand"
          />
          <span className="text-sm text-ink-faint">to</span>
          <input
            type="date"
            aria-label="Last day"
            value={prefs.endDate}
            min={prefs.startDate}
            disabled={multiCity}
            title={multiCity ? "Set by the days in each city" : undefined}
            onChange={(event) => set("endDate", event.target.value)}
            className="min-w-0 flex-1 rounded-xl border border-line bg-paper px-3 py-2.5 text-sm text-ink outline-none focus:border-brand disabled:cursor-not-allowed disabled:bg-paper-sunken disabled:text-ink-soft"
          />
        </div>
        {multiCity && <p className="mt-1.5 text-xs text-ink-faint">The last day follows from the days you give each city.</p>}
      </Row>

      <Row label="Who's going" source={readFrom.travellerType}>
        <Chips
          items={TRAVELLER_TYPES}
          isActive={(id) => prefs.travellerType === id}
          onPick={(id) => set("travellerType", id as TravellerType)}
        />
      </Row>

      <Row label="What you're into" source={readFrom.interests}>
        <Chips
          items={INTERESTS}
          isActive={(id) => prefs.interests.includes(id as Interest)}
          onPick={(id) => toggleInterest(id as Interest)}
        />
      </Row>

      <Row label="How local" source={readFrom.dial}>
        <Chips
          items={DIAL_POSITIONS}
          isActive={(id) => prefs.dial === id}
          onPick={(id) => set("dial", id as DialPosition)}
        />
        <p className="mt-1.5 text-xs text-ink-faint">
          {DIAL_POSITIONS.find((d) => d.id === prefs.dial)?.blurb}
        </p>
      </Row>

      <Row label="Pace" source={readFrom.pace}>
        <Chips
          items={PACES}
          isActive={(id) => prefs.pace === id}
          onPick={(id) => set("pace", id as Pace)}
        />
      </Row>

      <Row label="Budget" source={readFrom.budgetPerDay}>
        <CurrencyInput
          label=""
          value={{ amount: prefs.budgetPerDay, currency: prefs.budgetCurrency }}
          onChange={(money) => {
            onChange({ ...prefs, budgetPerDay: money.amount, budgetCurrency: money.currency });
          }}
        />
      </Row>

      {avoid.length > 0 && (
        <div className="rounded-2xl bg-paper px-4 py-3">
          <p className="text-sm font-semibold text-ink">You said you&rsquo;d rather avoid</p>
          <p className="mt-1 text-sm leading-relaxed text-ink">{avoid.join(" · ")}</p>
          <p className="mt-1.5 text-xs leading-relaxed text-ink-faint">
            We&rsquo;ve pushed the dial away from tourist-heavy places for this. Beyond that, this
            is kept with the trip rather than acted on — we&rsquo;d rather show you that than
            pretend it changed more than it did.
          </p>
        </div>
      )}
    </div>
  );
}

/** The route of a multi-city trip: cities in order, days in each. */
function LegsEditor({ prefs, onChange }: { prefs: TripPrefs; onChange: (next: TripPrefs) => void }) {
  const legs = prefs.legs ?? [];
  const update = (next: typeof legs) => onChange(withLegs(prefs, next));

  return (
    <div className="space-y-2">
      <ol className="space-y-2">
        {legs.map((leg, index) => (
          <li key={index} className="flex flex-wrap items-center gap-2 rounded-2xl bg-paper px-3 py-2.5">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand text-xs font-semibold tabular-nums text-white">{index + 1}</span>
            <div className="min-w-[10rem] flex-1">
              {leg.destination && <p className="font-display text-lg leading-tight text-ink">{leg.destination}</p>}
              <DestinationSelector
                placeholder={leg.destination ? "Change city" : "Choose a city"}
                onSelect={(destination) => update(legs.map((l, i) => (i === index ? { ...l, destination: destination.name } : l)))}
              />
            </div>
            <label className="flex items-center gap-1.5 text-sm text-ink-soft">
              <input
                type="number"
                min={1}
                max={14}
                value={leg.days}
                aria-label={`Days in ${leg.destination || `city ${index + 1}`}`}
                onChange={(event) => update(legs.map((l, i) => (i === index ? { ...l, days: Number(event.target.value) || 1 } : l)))}
                className="w-16 rounded-xl border border-line bg-paper-raised px-2 py-2 text-center tabular-nums text-ink outline-none focus:border-brand"
              />
              {leg.days === 1 ? "day" : "days"}
            </label>
            <button
              type="button"
              onClick={() => update(legs.filter((_, i) => i !== index))}
              aria-label={`Remove ${leg.destination || "this city"}`}
              className="grid h-9 w-9 place-items-center rounded-full text-ink-faint transition hover:bg-paper-sunken hover:text-danger"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ol>
      {legs.length < 5 && (
        <button type="button" onClick={() => update([...legs, { destination: "", days: 2 }])} className="text-sm font-semibold text-brand hover:underline">
          + Add another city
        </button>
      )}
    </div>
  );
}

function Row({
  label,
  source,
  note,
  children,
}: {
  label: string;
  source?: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <h3 className="text-sm font-semibold text-ink">{label}</h3>
        {source ? (
          <span className="text-xs text-moss">read from &ldquo;{source}&rdquo;</span>
        ) : (
          <span className="text-xs text-gold">we guessed — check this</span>
        )}
        {note && <span className="ml-auto text-xs tabular-nums text-ink-faint">{note}</span>}
      </div>
      {children}
    </section>
  );
}

function Chips({
  items,
  isActive,
  onPick,
}: {
  items: readonly { id: string; label: string }[];
  isActive: (id: string) => boolean;
  onPick: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          aria-pressed={isActive(item.id)}
          onClick={() => onPick(item.id)}
          className={`rounded-full border px-3.5 py-2 text-sm transition active:scale-[0.97] ${
            isActive(item.id)
              ? "border-brand bg-brand text-paper-raised"
              : "border-line bg-paper text-ink hover:border-brand"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
