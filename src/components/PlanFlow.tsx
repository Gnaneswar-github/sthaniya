"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { TripView } from "./TripView";
import { Understanding } from "./Understanding";
import { destinationByName } from "@/lib/destinations";
import { parseIntent, type ParsedIntent } from "@/lib/parse-intent";
import { buildTrip } from "@/lib/trip-engine";
import type { Recommendation, Trip, TripPrefs } from "@/lib/types";

const STORAGE_KEY = "sthaniya.trip.v3";

function isoIn(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Everything the parser missed falls back to a sane default that the UI flags as a guess. */
function toPrefs(intent: ParsedIntent, raw: string): TripPrefs {
  const days = intent.durationDays?.value ?? 3;
  return {
    destination: intent.destination?.value ?? "",
    startDate: isoIn(1),
    endDate: isoIn(days),
    travellerType: intent.travellerType?.value ?? "solo",
    interests: intent.interests.length > 0 ? intent.interests.map((i) => i.value) : ["food", "local_life"],
    dial: intent.dial?.value ?? "local",
    pace: intent.pace?.value ?? "balanced",
    budgetPerDay: intent.budgetPerDay?.value ?? 3000,
    budgetCurrency: intent.budgetPerDay?.currency ?? "INR",
    notes: raw,
  };
}

export function PlanFlow({ query }: { query: string }) {
  const intent = useMemo(() => parseIntent(query), [query]);
  const [prefs, setPrefs] = useState<TripPrefs>(() => toPrefs(intent, query));
  const [trip, setTrip] = useState<Trip | null>(null);
  const [pool, setPool] = useState<Recommendation[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const readFrom = {
    destination: intent.destination?.matched,
    startDate: intent.durationDays?.matched,
    travellerType: intent.travellerType?.matched,
    interests: intent.interests[0]?.matched,
    dial: intent.dial?.matched,
    pace: intent.pace?.matched,
    budgetPerDay: intent.budgetPerDay?.matched,
  };

  const fetchPool = useCallback(async (destination: string) => {
    const response = await fetch(`/api/places?destination=${encodeURIComponent(destination)}`);
    if (!response.ok) throw new Error("lookup failed");
    const { places } = (await response.json()) as { places: Recommendation[] };
    return places;
  }, []);

  // Restore an in-progress trip, but only once its place pool is in hand to edit against.
  useEffect(() => {
    if (query) return;
    let live = true;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as Trip;
      fetchPool(saved.prefs.destination)
        .then((places) => {
          if (!live) return;
          setPool(places);
          setTrip(saved);
          setPrefs(saved.prefs);
        })
        .catch(() => undefined);
    } catch {
      // Blocked storage just means there's nothing to restore.
    }
    return () => {
      live = false;
    };
  }, [query, fetchPool]);

  async function build() {
    if (!prefs.destination.trim()) {
      setError("Tell us where you're going and we'll take it from there.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const places = await fetchPool(prefs.destination);
      const built = buildTrip(places, prefs);
      setPool(places);
      setTrip(built);
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(built));
      } catch {
        // Not fatal — the trip simply won't survive a reload.
      }
    } catch {
      setError("Something went wrong building the trip. Try again?");
    } finally {
      setBusy(false);
    }
  }

  function update(next: Trip) {
    setTrip(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // As above.
    }
  }

  function discard() {
    setTrip(null);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // As above.
    }
  }

  if (trip) {
    // A dashboard of zeroes helps nobody. If there's nothing verified to build from, say that
    // and hand back what we do genuinely know about the place.
    const empty = trip.days.every((day) => day.items.length === 0);
    if (empty) {
      return <NotVerifiedYet destination={trip.prefs.destination} onBack={discard} />;
    }

    return <TripView trip={trip} pool={pool} onChange={update} onRestart={discard} />;
  }

  return (
    <div className="rise space-y-5">
      {query && (
        <blockquote className="rounded-2xl border-l-2 border-terracotta bg-paper-raised px-4 py-3 text-[15px] leading-relaxed text-ink-soft">
          &ldquo;{query}&rdquo;
        </blockquote>
      )}

      <Understanding prefs={prefs} readFrom={readFrom} avoid={intent.avoid} onChange={setPrefs} />

      {error && (
        <p className="rounded-xl border border-terracotta/30 bg-terracotta/5 px-4 py-3 text-sm text-ink-soft">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={build}
        disabled={busy}
        className="w-full rounded-xl bg-ink px-5 py-4 font-medium text-paper transition enabled:hover:bg-terracotta disabled:opacity-40"
      >
        {busy ? "Building your trip…" : "Build my trip"}
      </button>
    </div>
  );
}

function NotVerifiedYet({ destination, onBack }: { destination: string; onBack: () => void }) {
  const sourced = destinationByName(destination);

  return (
    <div className="rise space-y-5">
      <section className="rounded-3xl border border-saffron/40 bg-saffron/5 p-5 sm:p-7">
        <h2 className="font-display text-2xl leading-tight text-ink sm:text-3xl">
          We don&rsquo;t have {destination} verified yet
        </h2>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
          Sthānīya builds an itinerary only once a person has checked every recommendation in a
          city. We could fill this page with plausible-looking suggestions in seconds — that is
          precisely what this product exists to avoid.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/"
            className="rounded-xl bg-ink px-5 py-3 text-sm font-medium text-paper transition hover:bg-terracotta"
          >
            Browse verified destinations
          </Link>
          <button
            type="button"
            onClick={onBack}
            className="rounded-xl border border-line-strong px-4 py-3 text-sm text-ink-soft transition hover:border-terracotta hover:text-terracotta"
          >
            Edit my preferences
          </button>
        </div>
      </section>

      {sourced && (
        <section className="overflow-hidden rounded-3xl border border-line bg-paper-raised">
          <div className="relative aspect-[16/9] sm:aspect-[21/9]">
            <Image
              src={sourced.imageUrl}
              alt={sourced.name}
              fill
              sizes="(max-width: 768px) 100vw, 768px"
              className="object-cover"
            />
          </div>
          <div className="space-y-2 p-5 sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
              What we can tell you, sourced not written
            </p>
            <h3 className="font-display text-2xl text-ink">{sourced.name}</h3>
            <p className="text-[15px] leading-relaxed text-ink-soft">{sourced.extract}</p>
            <p className="pt-1 text-[11px] text-ink-faint">
              Summary from Wikipedia · Photo: {sourced.credit}
              {sourced.wikipediaUrl && (
                <>
                  {" · "}
                  <a
                    href={sourced.wikipediaUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="underline hover:text-terracotta"
                  >
                    Read more
                  </a>
                </>
              )}
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
