"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeftIcon, ArrowRightIcon } from "./icons";
import { ItemCard } from "./ItemCard";
import { MapLink } from "./MapLink";
import { TripMap } from "./TripMap";
import { WeatherGlyph } from "./WeatherGlyph";
import { earnsCommission, staysLink, toursLink } from "@/lib/affiliates";
import { track } from "@/lib/analytics";
import type { Member, Vote } from "@/lib/cloud-trips";
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
import { CATEGORIES, INTERESTS, LOCALITY_TAGS, type Category, type Recommendation, type Trip } from "@/lib/types";
import { describeWeather, type TripWeather } from "@/lib/weather";

const interestLabel = (id: string) => INTERESTS.find((i) => i.id === id)?.label ?? id;

/** Places people tend to book ahead; food and cafés are walk-in. */
const BOOKABLE: Category[] = ["sight", "museum", "outdoors", "temple"];

function dayLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" });
}

function nextDay(iso: string): string {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

export type CollabProps = {
  userId: string;
  members: Member[];
  votes: Vote[];
  inviteCode: string;
  onVote: (placeId: string, value: -1 | 0 | 1) => void;
  saving: boolean;
};

export function TripView({
  trip,
  pool,
  onChange,
  onRestart,
  collab,
  onSaveToAccount,
  accountState = "idle",
}: {
  trip: Trip;
  pool: Recommendation[];
  onChange: (trip: Trip) => void;
  onRestart: () => void;
  /** Present when this trip lives in an account and may be shared with others. */
  collab?: CollabProps;
  /** Present for a trip that isn't in an account yet. */
  onSaveToAccount?: () => void;
  accountState?: "idle" | "saving" | "saved" | "signin";
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

  /* weather — per city: forecast when close, last year's same dates when further out */
  const firstDate = trip.days[0]?.date;
  const lastDate = trip.days.at(-1)?.date;

  const weatherQueries = useMemo(() => {
    const cityOf = (day: Trip["days"][number]) => day.destination ?? trip.prefs.destination;
    const coordsByCity = new Map<string, { lat: number; lng: number }>();
    const ranges = new Map<string, { start: string; end: string }>();
    for (const day of trip.days) {
      const city = cityOf(day);
      const coords = day.items.find((i) => i.place.coords)?.place.coords;
      if (coords && !coordsByCity.has(city)) coordsByCity.set(city, coords);
      const range = ranges.get(city);
      if (range) range.end = day.date;
      else ranges.set(city, { start: day.date, end: day.date });
    }
    return [...ranges.entries()]
      .filter(([city]) => coordsByCity.has(city))
      .map(([city, range]) => {
        const c = coordsByCity.get(city)!;
        return `lat=${c.lat.toFixed(3)}&lng=${c.lng.toFixed(3)}&start=${range.start}&end=${range.end}`;
      })
      .join("|");
  }, [trip]);

  useEffect(() => {
    if (!weatherQueries) return;
    let live = true;
    Promise.all(
      weatherQueries.split("|").map((query) =>
        fetch(`/api/weather?${query}`)
          .then((response) => (response.ok ? (response.json() as Promise<TripWeather>) : null))
          .catch(() => null),
      ),
    ).then((results) => {
      if (!live) return;
      const found = results.filter((r): r is TripWeather => Boolean(r?.days));
      if (found.length) {
        setWeather({ kind: found.every((r) => r.kind === "forecast") ? "forecast" : "typical", days: found.flatMap((r) => r.days) });
      }
    });
    return () => {
      live = false;
    };
  }, [weatherQueries]);

  const weatherByDate = useMemo(() => new Map((weather?.days ?? []).map((d) => [d.date, d])), [weather]);
  const rainyOutdoorDates = useMemo(
    () =>
      trip.days
        .filter((d) => weatherByDate.get(d.date)?.rainy && d.items.some((i) => i.place.category === "outdoors"))
        .map((d) => d.date),
    [trip, weatherByDate],
  );

  /* planning together */
  const votesByPlace = useMemo(() => {
    const map = new Map<string, { up: number; down: number; mine: -1 | 0 | 1; names: string[] }>();
    if (!collab) return map;
    const names = new Map(collab.members.map((m) => [m.userId, m.name]));
    for (const vote of collab.votes) {
      const entry = map.get(vote.placeId) ?? { up: 0, down: 0, mine: 0 as -1 | 0 | 1, names: [] };
      if (vote.value === 1) entry.up += 1;
      else entry.down += 1;
      if (vote.userId === collab.userId) entry.mine = vote.value;
      entry.names.push(`${names.get(vote.userId) ?? "Someone"} (${vote.value === 1 ? "keep" : "skip"})`);
      map.set(vote.placeId, entry);
    }
    return map;
  }, [collab]);

  function apply(result: { trip: Trip; summary: string }, event?: string) {
    onChange(result.trip);
    setFlash(result.summary);
    if (event) track(event, { destination: trip.prefs.destination });
  }

  const selectOnMap = useCallback((itemId: string) => {
    setActive(itemId);
    document.getElementById(`stop-${itemId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  async function share() {
    try {
      const encoded = await encodeTrip(trip, pool);
      const url = `${window.location.origin}/trip#t=${encoded}`;
      track("trip_shared", { method: typeof navigator.share === "function" ? "native" : "link" });
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
    track("trip_exported", { format: "calendar" });
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
    track("stop_reordered", { method: "drag" });
  }

  const cities = [...new Set(trip.days.map((d) => d.destination ?? trip.prefs.destination))];

  return (
    <div className="grid gap-8 lg:grid-cols-12">
      <div className="min-w-0 space-y-6 lg:col-span-7">
        {/* summary */}
        <div className="rise space-y-4">
          <div className="no-print flex flex-wrap items-center justify-between gap-3">
            <button type="button" onClick={onRestart} className="inline-flex items-center gap-1.5 py-2 text-sm text-ink-soft transition hover:text-brand">
              <ArrowLeftIcon /> Start a new trip
            </button>
            <div className="flex flex-wrap gap-2">
              {onSaveToAccount && (
                <button
                  type="button"
                  onClick={onSaveToAccount}
                  disabled={accountState === "saving" || accountState === "saved"}
                  className="inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-xs font-semibold text-white shadow-sm transition enabled:hover:-translate-y-0.5 enabled:hover:bg-brand-deep disabled:opacity-80"
                >
                  <ToolIcon>
                    <path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16l-7-4Z" />
                  </ToolIcon>
                  {accountState === "saving"
                    ? "Saving…"
                    : accountState === "saved"
                      ? "Saved to your account"
                      : accountState === "signin"
                        ? "Sign in to save"
                        : "Save to my account"}
                </button>
              )}
              <ToolButton onClick={share} label="Share">
                <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v13" />
              </ToolButton>
              <ToolLink href={`https://wa.me/?text=${encodeURIComponent(tripToText(trip))}`} label="WhatsApp" onClick={() => track("trip_exported", { format: "whatsapp" })}>
                <path d="M3.5 20.5l1.3-4.2A8.5 8.5 0 1 1 8 19.3Z" />
              </ToolLink>
              <ToolButton onClick={downloadCalendar} label="Calendar">
                <path d="M4 6h16v14H4zM4 10h16M8 3v4M16 3v4" />
              </ToolButton>
              <ToolButton
                onClick={() => {
                  track("trip_exported", { format: "print" });
                  window.print();
                }}
                label="Print"
              >
                <path d="M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7z" />
              </ToolButton>
            </div>
          </div>

          <p className="text-[15px] text-ink-soft">
            {cities.length > 1 && <span className="font-semibold text-ink">{cities.join(" → ")} · </span>}
            {dayLabel(firstDate ?? trip.prefs.startDate)} — {dayLabel(lastDate ?? trip.prefs.endDate)} ·{" "}
            {trip.prefs.interests.map(interestLabel).join(" · ")}
          </p>

          <dl className="flex flex-wrap items-baseline gap-x-7 gap-y-2 border-y border-line py-3.5">
            <Fact label="Local score" value={`${stats.score}`} unit="/ 100" />
            <Fact label="Stops" value={`${stats.stops}`} unit={`over ${trip.days.length} ${trip.days.length === 1 ? "day" : "days"}`} />
            {stats.priced && (
              <Fact label="Entry costs" value={formatMoney({ amount: stats.cost, currency: stats.currency })} unit="estimated" />
            )}
            <Fact label="Getting around" value={durationLabel(stats.travel)} unit="allowed" />
          </dl>
        </div>

        {collab && <CollabPanel collab={collab} />}

        {/* reshape */}
        <div className="no-print space-y-3 rounded-3xl border border-line bg-paper-raised p-5">
          <h2 className="text-sm font-semibold text-ink">Reshape the whole trip</h2>
          <div className="flex flex-wrap gap-2">
            <Transform onClick={() => apply(makeMoreLocal(trip, pool), "trip_made_local")}>Make it more local</Transform>
            {stats.priced && <Transform onClick={() => apply(makeCheaper(trip, pool), "trip_made_cheaper")}>Make it cheaper</Transform>}
            <Transform onClick={() => apply(slowDown(trip), "trip_slowed")}>Slow it down</Transform>
          </div>
          {rainyOutdoorDates.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-indigo/10 px-4 py-3">
              <p className="flex items-center gap-2 text-sm text-ink">
                <WeatherGlyph icon="rain" className="h-5 w-5 text-indigo" />
                {weather?.kind === "forecast" ? "Rain is forecast" : "It often rains"} on{" "}
                {rainyOutdoorDates.map((date) => `Day ${trip.days.findIndex((d) => d.date === date) + 1}`).join(" and ")}.
              </p>
              <button
                type="button"
                onClick={() => apply(rainyDaySwap(trip, pool, rainyOutdoorDates), "rain_swap")}
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

        <BookingCard trip={trip} cities={cities} />

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
          const city = day.destination ?? trip.prefs.destination;
          const previousCity = dayIndex > 0 ? (trip.days[dayIndex - 1].destination ?? trip.prefs.destination) : city;

          return (
            <section key={day.date} id={`day-${dayIndex}`} className="scroll-mt-32 space-y-3">
              {cities.length > 1 && city !== previousCity && (
                <p className="flex items-center gap-2 rounded-2xl bg-deep px-4 py-2.5 text-sm font-medium text-white">
                  <ArrowRightIcon className="h-4 w-4 text-gold-bright" /> On to {city}
                </p>
              )}
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <div className="flex items-baseline gap-3">
                  <span className="h-3 w-3 translate-y-[-2px] rounded-full" style={{ background: color }} aria-hidden />
                  <h3 className="font-display text-3xl text-ink">Day {dayIndex + 1}</h3>
                  <span className="text-sm text-ink-faint">
                    {cities.length > 1 ? `${city} · ` : ""}
                    {dayLabel(day.date)}
                  </span>
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
                      onClick={() => track("route_opened")}
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
                    date={day.date}
                    dayIndex={dayIndex}
                    dayCount={trip.days.length}
                    isFirst={index === 0}
                    isLast={index === day.items.length - 1}
                    highlighted={active === item.itemId}
                    whyLine={whyItFitsLine(item.place, trip.prefs, interestLabel)}
                    vote={collab ? (votesByPlace.get(item.place.id) ?? { up: 0, down: 0, mine: 0, names: [] }) : undefined}
                    onVote={collab ? (value) => collab.onVote(item.place.id, value) : undefined}
                    tours={
                      BOOKABLE.includes(item.place.category)
                        ? {
                            ...toursLink(`${item.place.name}, ${item.place.destination}`),
                            onClick: () => track("booking_clicked", { kind: "tours", category: item.place.category }),
                          }
                        : undefined
                    }
                    actions={{
                      onReplace: () => setReplacing(replacing === item.itemId ? null : item.itemId),
                      onRemove: () => {
                        onChange(removeItem(trip, item.itemId));
                        setFlash(`Removed ${item.place.name}.`);
                        track("stop_removed");
                      },
                      onMore: () => {
                        recordTaste(item.place.category, "like");
                        apply(addSimilar(trip, pool, item.itemId), "more_like_this");
                      },
                      onNotForMe: () => {
                        recordTaste(item.place.category, "dislike");
                        onChange(removeItem(trip, item.itemId));
                        setFlash(`Got it — fewer ${CATEGORIES[item.place.category].toLowerCase()} stops from now on.`);
                        track("not_for_me", { category: item.place.category });
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
                        track("stop_replaced");
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
                    <p className="text-sm text-ink-faint">Every place we found for {city} is already in your trip.</p>
                  )}
                  {unused
                    .filter((place) => cities.length === 1 || place.destination === city)
                    .slice(0, 8)
                    .map((place) => (
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
                            track("stop_added");
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

/** Who's planning, how to bring someone in, and whether edits have reached everyone. */
function CollabPanel({ collab }: { collab: CollabProps }) {
  const [copied, setCopied] = useState(false);

  async function copyInvite() {
    const url = `${window.location.origin}/join/${collab.inviteCode}`;
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: "Plan this trip with me", url });
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2500);
      }
      track("invite_shared");
    } catch {
      // Dismissed.
    }
  }

  return (
    <section className="no-print flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-brand/25 bg-brand/5 p-5">
      <div className="flex items-center gap-3">
        <div className="flex -space-x-2">
          {collab.members.slice(0, 5).map((member) => (
            <span
              key={member.userId}
              title={`${member.name}${member.role === "owner" ? " (organiser)" : ""}`}
              className="grid h-9 w-9 place-items-center rounded-full bg-brand text-sm font-semibold uppercase text-white ring-2 ring-paper"
            >
              {member.name.charAt(0)}
            </span>
          ))}
        </div>
        <div>
          <p className="text-sm font-semibold text-ink">
            {collab.members.length === 1 ? "Just you so far" : `${collab.members.length} people planning`}
          </p>
          <p className="text-xs text-ink-faint">{collab.saving ? "Saving changes…" : "Changes and votes sync live for everyone"}</p>
        </div>
      </div>
      <button type="button" onClick={copyInvite} className="rounded-full bg-brand px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-brand-deep">
        {copied ? "Invite link copied" : "Invite people to plan"}
      </button>
    </section>
  );
}

/** Stays for the trip's dates, and tickets for each city. Discloses commission only when it applies. */
function BookingCard({ trip, cities }: { trip: Trip; cities: string[] }) {
  const firstDate = trip.days[0]?.date ?? trip.prefs.startDate;
  const lastDate = trip.days.at(-1)?.date ?? trip.prefs.endDate;

  return (
    <section className="no-print space-y-3 rounded-3xl border border-line bg-paper-raised p-5">
      <h2 className="text-sm font-semibold text-ink">Book what you need</h2>
      <div className="flex flex-wrap gap-2">
        {cities.map((city) => {
          const cityDays = trip.days.filter((d) => (d.destination ?? trip.prefs.destination) === city);
          const stays = staysLink({
            city,
            checkin: cityDays[0]?.date ?? firstDate,
            checkout: nextDay(cityDays.at(-1)?.date ?? lastDate),
            travellerType: trip.prefs.travellerType,
          });
          const tours = toursLink(city);
          return (
            <span key={city} className="flex flex-wrap gap-2">
              <a
                href={stays.url}
                target="_blank"
                rel="sponsored noopener noreferrer"
                onClick={() => track("booking_clicked", { kind: "stays", provider: stays.provider })}
                className="rounded-full bg-deep px-4 py-2 text-xs font-semibold text-white transition hover:-translate-y-0.5 hover:bg-deep-2"
              >
                Stays in {city} · {stays.provider}
              </a>
              <a
                href={tours.url}
                target="_blank"
                rel="sponsored noopener noreferrer"
                onClick={() => track("booking_clicked", { kind: "tours", provider: tours.provider })}
                className="rounded-full border border-line px-4 py-2 text-xs font-semibold text-ink-soft transition hover:-translate-y-0.5 hover:border-brand hover:text-brand"
              >
                Things to do in {city} · {tours.provider}
              </a>
            </span>
          );
        })}
      </div>
      {earnsCommission() && (
        <p className="text-[11px] text-ink-faint">We may earn a commission when you book through these links. It never changes what we recommend.</p>
      )}
    </section>
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
        <div key={place.id} className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-paper-raised p-3 transition hover:border-brand">
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
            className="shrink-0 rounded-full bg-brand px-4 py-2 text-xs font-semibold text-white transition hover:bg-brand-deep"
          >
            Swap in
          </button>
        </div>
      ))}
    </div>
  );
}

function Fact({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="text-sm text-ink-soft">{label}</dt>
      <dd className="font-display text-xl tabular-nums text-ink">
        {value}
        <span className="ml-1 font-sans text-xs text-ink-faint">{unit}</span>
      </dd>
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

function ToolLink({ children, label, href, onClick }: { children: React.ReactNode; label: string; href: string; onClick?: () => void }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" onClick={onClick} className={toolClass}>
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
