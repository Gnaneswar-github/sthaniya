"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ItemCard } from "./ItemCard";
import { MapLink } from "./MapLink";
import { TripMap } from "./TripMap";
import { WeatherGlyph } from "./WeatherGlyph";
import { formatMoney } from "@/lib/currency/format";
import { dayColor } from "@/lib/day-colors";
import { dayDirectionsUrl, tripToIcs, tripToText } from "@/lib/export";
import { encodeTrip } from "@/lib/share";
import { recordTaste } from "@/lib/taste";
import {
  addPlace,
  addSimilar,
  alternativesFor,
  durationLabel,
  makeCheaper,
  makeMoreLocal,
  moveItem,
  placeItem,
  placeLocalScore,
  rainyDaySwap,
  removeItem,
  replaceItem,
  shiftItem,
  slowDown,
  tripCost,
  tripCostCurrency,
  tripLocalScore,
  tripTravelMinutes,
  usedPlaceIds,
  whyItFitsLine,
  REPLACE_REASONS,
  type ReplaceReason,
} from "@/lib/trip-engine";
import { CATEGORIES, INTERESTS, LOCALITY_TAGS, type Recommendation, type Trip } from "@/lib/types";
import { describeWeather, type TripWeather } from "@/lib/weather";

const interestLabel = (id: string) => INTERESTS.find((i) => i.id === id)?.label ?? id;

function dayLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" });
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
  const [focusDay, setFocusDay] = useState<number | "all">("all");
  const [active, setActive] = useState<string | null>(null);
  const [weather, setWeather] = useState<TripWeather | null>(null);
  const [mobileMap, setMobileMap] = useState(false);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const dragging = useRef<string | null>(null);

  const stats = useMemo(
    () => ({
      score: tripLocalScore(trip),
      cost: tripCost(trip),
      currency: tripCostCurrency(trip),
      priced: trip.days.flatMap((d) => d.items).some((item) => item.place.priceBand !== "unknown"),
      travel: tripTravelMinutes(trip),
      stops: trip.days.flatMap((d) => d.items).length,
    }),
    [trip],
  );

  const unused = useMemo(() => {
    const used = usedPlaceIds(trip);
    return pool.filter((p) => !used.has(p.id));
  }, [trip, pool]);

  /* weather — forecast when close, last year's same dates when further out */
  const anchor = useMemo(() => trip.days.flatMap((d) => d.items).find((i) => i.place.coords)?.place.coords ?? null, [trip]);
  const anchorKey = anchor ? `${anchor.lat.toFixed(3)},${anchor.lng.toFixed(3)}` : null;
  const firstDate = trip.days[0]?.date;
  const lastDate = trip.days.at(-1)?.date;

  useEffect(() => {
    if (!anchorKey || !firstDate || !lastDate) return;
    const [lat, lng] = anchorKey.split(",");
    let live = true;
    fetch(`/api/weather?lat=${lat}&lng=${lng}&start=${firstDate}&end=${lastDate}`)
      .then((response) => (response.ok ? (response.json() as Promise<TripWeather>) : null))
      .then((data) => {
        if (live && data?.days) setWeather(data);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [anchorKey, firstDate, lastDate]);

  const weatherByDate = useMemo(() => new Map((weather?.days ?? []).map((d) => [d.date, d])), [weather]);
  const rainyOutdoorDates = useMemo(
    () =>
      trip.days
        .filter((d) => weatherByDate.get(d.date)?.rainy && d.items.some((i) => i.place.category === "outdoors"))
        .map((d) => d.date),
    [trip, weatherByDate],
  );

  function apply(result: { trip: Trip; summary: string }) {
    onChange(result.trip);
    setFlash(result.summary);
  }

  const selectOnMap = useCallback((itemId: string) => {
    setActive(itemId);
    document.getElementById(`stop-${itemId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  async function share() {
    try {
      const encoded = await encodeTrip(trip, pool);
      const url = `${window.location.origin}/trip#t=${encoded}`;
      if (typeof navigator.share === "function") {
        await navigator.share({ title: `${trip.prefs.destination} — my trip`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setFlash("Link copied. Anyone with it can open this trip — no account needed.");
    } catch {
      // The share sheet was dismissed; nothing to report.
    }
  }

  function downloadCalendar() {
    const blob = new Blob([tripToIcs(trip)], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${trip.prefs.destination.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-trip.ics`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
    setFlash("Calendar file downloaded — open it to add every stop to your calendar.");
  }

  function drop(dayIndex: number, beforeItemId: string | null) {
    const id = dragging.current;
    dragging.current = null;
    setDropTarget(null);
    if (!id) return;
    const without = trip.days[dayIndex].items.filter((i) => i.itemId !== id);
    let at = beforeItemId ? without.findIndex((i) => i.itemId === beforeItemId) : without.length;
    if (at === -1) at = without.length;
    onChange(placeItem(trip, id, dayIndex, at));
  }

  const lead = stats.priced
    ? { label: "Entry costs", value: formatMoney({ amount: stats.cost, currency: stats.currency }), sub: "estimated" }
    : { label: "Days", value: `${trip.days.length}`, sub: `${dayLabel(firstDate ?? trip.prefs.startDate).split(" ")[0]} start` };

  return (
    <div className="grid gap-8 lg:grid-cols-12">
      <div className="min-w-0 space-y-6 lg:col-span-7">
        {/* summary */}
        <div className="rise space-y-4">
          <div className="no-print flex flex-wrap items-center justify-between gap-3">
            <button type="button" onClick={onRestart} className="text-sm text-ink-faint transition hover:text-brand">
              ← Start a new trip
            </button>
            <div className="flex flex-wrap gap-2">
              <ToolButton onClick={share} label="Share">
                <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v13" />
              </ToolButton>
              <ToolLink href={`https://wa.me/?text=${encodeURIComponent(tripToText(trip))}`} label="WhatsApp">
                <path d="M3.5 20.5l1.3-4.2A8.5 8.5 0 1 1 8 19.3Z" />
              </ToolLink>
              <ToolButton onClick={downloadCalendar} label="Calendar">
                <path d="M4 6h16v14H4zM4 10h16M8 3v4M16 3v4" />
              </ToolButton>
              <ToolButton onClick={() => window.print()} label="Print">
                <path d="M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7z" />
              </ToolButton>
            </div>
          </div>

          <p className="text-[15px] text-ink-soft">
            {dayLabel(firstDate ?? trip.prefs.startDate)} — {dayLabel(lastDate ?? trip.prefs.endDate)} ·{" "}
            {trip.prefs.interests.map(interestLabel).join(" · ")}
          </p>

          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <Stat label="Local score" value={`${stats.score}`} sub="out of 100" />
            <Stat label="Stops" value={`${stats.stops}`} sub={`${trip.days.length} ${trip.days.length === 1 ? "day" : "days"}`} />
            <Stat label={lead.label} value={lead.value} sub={lead.sub} />
            <Stat label="Getting around" value={durationLabel(stats.travel)} sub="allowance" />
          </div>
        </div>

        {/* reshape */}
        <div className="no-print space-y-3 rounded-3xl border border-line bg-paper-raised p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Reshape the whole trip</p>
          <div className="flex flex-wrap gap-2">
            <Transform onClick={() => apply(makeMoreLocal(trip, pool))}>Make it more local</Transform>
            {stats.priced && <Transform onClick={() => apply(makeCheaper(trip, pool))}>Make it cheaper</Transform>}
            <Transform onClick={() => apply(slowDown(trip))}>Slow it down</Transform>
          </div>
          {rainyOutdoorDates.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#35506a]/8 px-4 py-3">
              <p className="flex items-center gap-2 text-sm text-ink">
                <WeatherGlyph icon="rain" className="h-5 w-5 text-indigo" />
                {weather?.kind === "forecast" ? "Rain is forecast" : "It often rains"} on{" "}
                {rainyOutdoorDates.map((date) => `Day ${trip.days.findIndex((d) => d.date === date) + 1}`).join(" and ")}.
              </p>
              <button
                type="button"
                onClick={() => apply(rainyDaySwap(trip, pool, rainyOutdoorDates))}
                className="rounded-full bg-indigo px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90"
              >
                Swap in indoor stops
              </button>
            </div>
          )}
          <p aria-live="polite" className={`text-sm text-brand transition ${flash ? "opacity-100" : "opacity-0"}`}>
            {flash ?? " "}
          </p>
        </div>

        {trip.notes.map((note) => (
          <p key={note} className="rounded-2xl border border-gold/30 bg-gold/5 px-4 py-3 text-[15px] leading-relaxed text-ink-soft">
            {note}
          </p>
        ))}

        {/* day filter + mobile map */}
        <div className="no-print sticky top-[65px] z-20 -mx-5 flex items-center gap-2 overflow-x-auto bg-paper/90 px-5 py-2 backdrop-blur lg:static lg:mx-0 lg:bg-transparent lg:px-0 lg:backdrop-blur-none">
          <DayPill active={focusDay === "all"} onClick={() => setFocusDay("all")}>
            All days
          </DayPill>
          {trip.days.map((day, index) => (
            <DayPill
              key={day.date}
              active={focusDay === index}
              color={dayColor(index)}
              onClick={() => {
                setFocusDay(index);
                document.getElementById(`day-${index}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              Day {index + 1}
            </DayPill>
          ))}
          <button
            type="button"
            onClick={() => setMobileMap((open) => !open)}
            className="ml-auto shrink-0 rounded-full bg-ink px-3.5 py-1.5 text-xs font-semibold text-paper lg:hidden"
          >
            {mobileMap ? "Hide map" : "Show map"}
          </button>
        </div>

        {mobileMap && (
          <div className="h-80 overflow-hidden rounded-3xl border border-line lg:hidden">
            <TripMap trip={trip} focusDay={focusDay} activeItem={active} onSelect={selectOnMap} />
          </div>
        )}

        {trip.days.map((day, dayIndex) => {
          const forecast = weatherByDate.get(day.date);
          const directions = dayDirectionsUrl(day.items);
          const color = dayColor(dayIndex);

          return (
            <section key={day.date} id={`day-${dayIndex}`} className="scroll-mt-32 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <div className="flex items-baseline gap-3">
                  <span className="h-3 w-3 translate-y-[-2px] rounded-full" style={{ background: color }} aria-hidden />
                  <h3 className="font-display text-3xl text-ink">Day {dayIndex + 1}</h3>
                  <span className="text-sm text-ink-faint">{dayLabel(day.date)}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {forecast && (
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full bg-paper-raised px-3 py-1 text-xs text-ink-soft ring-1 ring-line"
                      title={weather?.kind === "typical" ? "What these dates looked like last year" : "Forecast from Open-Meteo"}
                    >
                      <WeatherGlyph icon={describeWeather(forecast.code).icon} className="h-4 w-4 text-gold" />
                      {forecast.max}° / {forecast.min}°
                      {forecast.rainChance !== null && forecast.rainChance >= 20 && <span>· {forecast.rainChance}% rain</span>}
                      {weather?.kind === "typical" && <span className="text-ink-faint">· typical</span>}
                    </span>
                  )}
                  {directions && (
                    <a
                      href={directions}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="no-print inline-flex items-center gap-1.5 rounded-full bg-paper-raised px-3 py-1 text-xs font-medium text-ink-soft ring-1 ring-line transition hover:text-brand hover:ring-brand"
                    >
                      <svg aria-hidden viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2}><path d="M9 20l-5-2V4l5 2 6-2 5 2v14l-5-2-6 2ZM9 6v14M15 4v14" /></svg>
                      Route in Google Maps
                    </a>
                  )}
                </div>
              </div>

              {day.items.length === 0 && (
                <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-sm text-ink-faint">
                  A free day to wander. Add something below, or drag a stop here.
                </p>
              )}

              {day.items.map((item, index) => (
                <div
                  key={item.itemId}
                  draggable
                  onDragStart={(event) => {
                    dragging.current = item.itemId;
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", item.itemId);
                  }}
                  onDragEnd={() => {
                    dragging.current = null;
                    setDropTarget(null);
                  }}
                  onDragOver={(event) => {
                    if (!dragging.current || dragging.current === item.itemId) return;
                    event.preventDefault();
                    setDropTarget(item.itemId);
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    drop(dayIndex, item.itemId);
                  }}
                  className={`space-y-2 rounded-3xl transition ${dropTarget === item.itemId ? "ring-2 ring-brand ring-offset-4 ring-offset-paper" : ""}`}
                >
                  <ItemCard
                    item={item}
                    stop={index + 1}
                    color={color}
                    dayIndex={dayIndex}
                    dayCount={trip.days.length}
                    isFirst={index === 0}
                    isLast={index === day.items.length - 1}
                    highlighted={active === item.itemId}
                    whyLine={whyItFitsLine(item.place, trip.prefs, interestLabel)}
                    actions={{
                      onReplace: () => setReplacing(replacing === item.itemId ? null : item.itemId),
                      onRemove: () => {
                        onChange(removeItem(trip, item.itemId));
                        setFlash(`Removed ${item.place.name}.`);
                      },
                      onMore: () => {
                        recordTaste(item.place.category, "like");
                        apply(addSimilar(trip, pool, item.itemId));
                      },
                      onNotForMe: () => {
                        recordTaste(item.place.category, "dislike");
                        onChange(removeItem(trip, item.itemId));
                        setFlash(`Got it — fewer ${CATEGORIES[item.place.category].toLowerCase()} stops from now on.`);
                      },
                      onShift: (direction) => onChange(shiftItem(trip, item.itemId, direction)),
                      onMoveDay: (target) => {
                        onChange(moveItem(trip, item.itemId, target));
                        setFlash(`Moved ${item.place.name} to Day ${target + 1}.`);
                      },
                      onHover: setActive,
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

              <div
                onDragOver={(event) => {
                  if (!dragging.current) return;
                  event.preventDefault();
                  setDropTarget(`end-${dayIndex}`);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  drop(dayIndex, null);
                }}
                className="no-print"
              >
                <button
                  type="button"
                  onClick={() => setAdding(adding === dayIndex ? null : dayIndex)}
                  className={`w-full rounded-2xl border border-dashed px-4 py-3 text-sm transition hover:border-brand hover:text-brand ${
                    dropTarget === `end-${dayIndex}` ? "border-brand bg-brand/5 text-brand" : "border-line text-ink-soft"
                  }`}
                >
                  {dropTarget === `end-${dayIndex}` ? "Drop to add to the end of this day" : adding === dayIndex ? "Close" : "+ Add a stop to this day"}
                </button>
              </div>

              {adding === dayIndex && (
                <div className="space-y-2 rounded-3xl border border-line bg-paper-raised p-4">
                  {unused.length === 0 && (
                    <p className="text-sm text-ink-faint">Every place we found for {trip.prefs.destination} is already in your trip.</p>
                  )}
                  {unused.slice(0, 8).map((place) => (
                    <div key={place.id} className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 transition hover:bg-paper">
                      <span className="min-w-0">
                        <MapLink name={place.name} near={place.destination} className="text-[15px] text-ink" />
                        <span className="block text-xs text-ink-faint">
                          {CATEGORIES[place.category]} · {LOCALITY_TAGS[place.tag]} · {placeLocalScore(place)} local
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          onChange(addPlace(trip, place, dayIndex));
                          setAdding(null);
                          setFlash(`Added ${place.name} to Day ${dayIndex + 1}.`);
                        }}
                        className="shrink-0 rounded-full border border-line px-3 py-1 text-xs font-medium text-ink-soft transition hover:border-brand hover:text-brand"
                      >
                        Add
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>

      <aside className="no-print hidden lg:col-span-5 lg:block">
        <div className="sticky top-24 h-[calc(100vh-7.5rem)] overflow-hidden rounded-3xl border border-line shadow-[0_24px_60px_-40px_rgba(13,47,66,0.6)]">
          <TripMap trip={trip} focusDay={focusDay} activeItem={active} onSelect={selectOnMap} />
        </div>
      </aside>
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
    <div className="space-y-3 rounded-3xl border border-brand/30 bg-brand/5 p-4">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-medium text-ink">Why swap this one out?</p>
        <button type="button" onClick={onClose} className="text-xs text-ink-faint hover:text-brand">
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
              reason === option.id ? "border-brand bg-brand text-paper-raised" : "border-line bg-paper-raised text-ink-soft hover:border-brand"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {reason && options.length === 0 && (
        <p className="text-sm text-ink-soft">Nothing else fits that quite as well. Keep this stop, or remove it and enjoy the extra time.</p>
      )}

      {options.map((place) => (
        <div
          key={place.id}
          className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-paper-raised p-3 transition hover:border-brand"
        >
          <span className="min-w-0">
            <MapLink name={place.name} near={place.destination} className="font-display text-lg text-ink" />
            <span className="block text-sm text-ink-soft">{place.vibe}</span>
            <span className="mt-1 block text-xs text-ink-faint">
              {LOCALITY_TAGS[place.tag]} · {placeLocalScore(place)} local
            </span>
          </span>
          <button
            type="button"
            onClick={() => onPick(place)}
            className="shrink-0 rounded-full bg-brand px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-bright"
          >
            Swap in
          </button>
        </div>
      ))}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-line bg-paper-raised px-3.5 py-3">
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
      className="rounded-full border border-line bg-paper px-4 py-2 text-sm text-ink transition hover:-translate-y-0.5 hover:border-brand hover:text-brand"
    >
      {children}
    </button>
  );
}

function DayPill({
  children,
  active,
  color,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  color?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
        active ? "bg-ink text-paper" : "bg-paper-raised text-ink-soft ring-1 ring-line hover:ring-brand"
      }`}
    >
      {color && <span className="h-2 w-2 rounded-full" style={{ background: color }} aria-hidden />}
      {children}
    </button>
  );
}

const toolClass =
  "inline-flex items-center gap-1.5 rounded-full border border-line bg-paper-raised px-3.5 py-2 text-xs font-semibold text-ink-soft transition hover:-translate-y-0.5 hover:border-brand hover:text-brand";

function ToolButton({ children, label, onClick }: { children: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={toolClass}>
      <ToolIcon>{children}</ToolIcon>
      {label}
    </button>
  );
}

function ToolLink({ children, label, href }: { children: React.ReactNode; label: string; href: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={toolClass}>
      <ToolIcon>{children}</ToolIcon>
      {label}
    </a>
  );
}

function ToolIcon({ children }: { children: React.ReactNode }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}
