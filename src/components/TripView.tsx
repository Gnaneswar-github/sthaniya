"use client";

import { useMemo, useState } from "react";
import { ItemCard } from "./ItemCard";
import {
  addPlace,
  alternativesFor,
  durationLabel,
  makeCheaper,
  makeMoreLocal,
  placeLocalScore,
  removeItem,
  replaceItem,
  slowDown,
  tripCost,
  tripLocalScore,
  tripTravelMinutes,
  usedPlaceIds,
  whyItFitsLine,
  REPLACE_REASONS,
  type ReplaceReason,
} from "@/lib/trip-engine";
import { INTERESTS, LOCALITY_TAGS, type Recommendation, type Trip } from "@/lib/types";

const interestLabel = (id: string) => INTERESTS.find((i) => i.id === id)?.label ?? id;

function dayLabel(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" });
}

export function TripView({
  trip,
  pool,
  onChange,
  onRestart,
}: {
  trip: Trip;
  pool: Recommendation[];
  onChange: (trip: Trip) => void;
  onRestart: () => void;
}) {
  const [replacing, setReplacing] = useState<string | null>(null);
  const [adding, setAdding] = useState<number | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const stats = useMemo(
    () => ({
      score: tripLocalScore(trip),
      cost: tripCost(trip),
      travel: tripTravelMinutes(trip),
      stops: trip.days.flatMap((d) => d.items).length,
    }),
    [trip],
  );

  const unused = useMemo(() => {
    const used = usedPlaceIds(trip);
    return pool.filter((p) => !used.has(p.id));
  }, [trip, pool]);

  function apply(result: { trip: Trip; summary: string }) {
    onChange(result.trip);
    setFlash(result.summary);
  }

  return (
    <div className="space-y-7">
      <div className="rise space-y-3">
        <button
          type="button"
          onClick={onRestart}
          className="text-sm text-ink-faint transition hover:text-terracotta"
        >
          ← Start a new trip
        </button>

        <div>
          <h2 className="font-display text-4xl leading-tight text-ink">{trip.prefs.destination}</h2>
          <p className="mt-1 text-[15px] text-ink-soft">
            {dayLabel(trip.days[0]?.date ?? trip.prefs.startDate)} —{" "}
            {dayLabel(trip.days.at(-1)?.date ?? trip.prefs.endDate)} ·{" "}
            {trip.prefs.interests.map(interestLabel).join(" · ")}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Local score" value={`${stats.score}`} sub="out of 100" />
          <Stat label="Entry costs" value={`₹${stats.cost.toLocaleString("en-IN")}`} sub="estimated" />
          <Stat label="Stops" value={`${stats.stops}`} sub={`${trip.days.length} days`} />
          <Stat label="Getting around" value={durationLabel(stats.travel)} sub="allowance" />
        </div>

        <p className="text-xs leading-relaxed text-ink-faint">
          Local score is derived from how we&rsquo;ve classified each place, not from scraped
          popularity. Costs are rough entry estimates per person and exclude food, stays and
          transport.
        </p>
      </div>

      <div className="space-y-2 rounded-2xl border border-line bg-paper-raised p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
          Reshape the whole trip
        </p>
        <div className="flex flex-wrap gap-2">
          <Transform onClick={() => apply(makeMoreLocal(trip, pool))}>Make it more local</Transform>
          <Transform onClick={() => apply(makeCheaper(trip, pool))}>Make it cheaper</Transform>
          <Transform onClick={() => apply(slowDown(trip))}>Slow it down</Transform>
        </div>
        {flash && <p className="pt-1 text-sm text-ink-soft">{flash}</p>}
      </div>

      {trip.notes.map((note) => (
        <p
          key={note}
          className="rounded-xl border border-saffron/30 bg-saffron/5 px-4 py-3 text-[15px] leading-relaxed text-ink-soft"
        >
          {note}
        </p>
      ))}

      {trip.days.map((day, dayIndex) => (
        <section key={day.date} className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="font-display text-2xl text-ink">Day {dayIndex + 1}</h3>
            <span className="text-sm text-ink-faint">{dayLabel(day.date)}</span>
          </div>

          {day.items.length === 0 && (
            <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-ink-faint">
              Nothing planned. Add something below.
            </p>
          )}

          {day.items.map((item) => (
            <div key={item.itemId} className="space-y-2">
              <ItemCard
                item={item}
                whyLine={whyItFitsLine(item.place, trip.prefs, interestLabel)}
                onReplace={() => setReplacing(replacing === item.itemId ? null : item.itemId)}
                onRemove={() => {
                  onChange(removeItem(trip, item.itemId));
                  setFlash(null);
                }}
              />

              {replacing === item.itemId && (
                <ReplacePanel
                  trip={trip}
                  pool={pool}
                  itemId={item.itemId}
                  onPick={(replacement) => {
                    onChange(replaceItem(trip, item.itemId, replacement));
                    setReplacing(null);
                    setFlash(`Swapped in ${replacement.name}.`);
                  }}
                  onClose={() => setReplacing(null)}
                />
              )}
            </div>
          ))}

          <button
            type="button"
            onClick={() => setAdding(adding === dayIndex ? null : dayIndex)}
            className="w-full rounded-xl border border-dashed border-line px-4 py-3 text-sm text-ink-soft transition hover:border-terracotta hover:text-terracotta"
          >
            {adding === dayIndex ? "Close" : "Add a stop to this day"}
          </button>

          {adding === dayIndex && (
            <div className="space-y-2 rounded-2xl border border-line bg-paper-raised p-4">
              {unused.length === 0 && (
                <p className="text-sm text-ink-faint">
                  Every place we have verified for {trip.prefs.destination} is already in this trip.
                </p>
              )}
              {unused.slice(0, 8).map((place) => (
                <button
                  key={place.id}
                  type="button"
                  onClick={() => {
                    onChange(addPlace(trip, place, dayIndex));
                    setAdding(null);
                    setFlash(`Added ${place.name} to day ${dayIndex + 1}.`);
                  }}
                  className="flex w-full items-baseline justify-between gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-paper"
                >
                  <span className="text-[15px] text-ink">{place.name}</span>
                  <span className="shrink-0 text-xs text-ink-faint">
                    {LOCALITY_TAGS[place.tag]} · {placeLocalScore(place)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

function ReplacePanel({
  trip,
  pool,
  itemId,
  onPick,
  onClose,
}: {
  trip: Trip;
  pool: Recommendation[];
  itemId: string;
  onPick: (place: Recommendation) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState<ReplaceReason | null>(null);
  const options = reason ? alternativesFor(trip, pool, itemId, reason) : [];

  return (
    <div className="space-y-3 rounded-2xl border border-terracotta/30 bg-terracotta/5 p-4">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-medium text-ink">Why swap this one out?</p>
        <button type="button" onClick={onClose} className="text-xs text-ink-faint hover:text-terracotta">
          Cancel
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {REPLACE_REASONS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setReason(option.id)}
            className={`rounded-full border px-3 py-1.5 text-xs transition ${
              reason === option.id
                ? "border-terracotta bg-terracotta text-paper-raised"
                : "border-line bg-paper-raised text-ink-soft hover:border-terracotta"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {reason && options.length === 0 && (
        <p className="text-sm text-ink-soft">
          Nothing in our verified set fits that. Rather than offer you something worse, we&rsquo;d
          suggest keeping this stop or removing it outright.
        </p>
      )}

      {options.map((place) => (
        <button
          key={place.id}
          type="button"
          onClick={() => onPick(place)}
          className="block w-full rounded-xl border border-line bg-paper-raised p-3 text-left transition hover:border-terracotta"
        >
          <span className="font-display text-lg text-ink">{place.name}</span>
          <span className="block text-sm text-ink-soft">{place.vibe}</span>
          <span className="mt-1 block text-xs text-ink-faint">
            {LOCALITY_TAGS[place.tag]} · {placeLocalScore(place)} local
          </span>
        </button>
      ))}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-line bg-paper-raised px-3 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-faint">{label}</p>
      <p className="font-display text-2xl leading-tight text-ink">{value}</p>
      <p className="text-[11px] text-ink-faint">{sub}</p>
    </div>
  );
}

function Transform({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-line bg-paper px-4 py-2 text-sm text-ink transition hover:border-terracotta hover:text-terracotta"
    >
      {children}
    </button>
  );
}
