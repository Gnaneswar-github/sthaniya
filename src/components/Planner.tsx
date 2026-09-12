"use client";

import { useCallback, useEffect, useState } from "react";
import { TripSetup } from "./TripSetup";
import { TripView } from "./TripView";
import { buildTrip } from "@/lib/trip-engine";
import type { Recommendation, Trip, TripPrefs } from "@/lib/types";

const STORAGE_KEY = "sthaniya.trip.v2";

/** Trips live in the browser. No login is the point, so there is nowhere else to put them. */
function load(): Trip | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Trip) : null;
  } catch {
    return null;
  }
}

function save(trip: Trip | null) {
  try {
    if (trip) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trip));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // A private window or blocked storage just means the trip won't survive a reload.
  }
}

export function Planner() {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [pool, setPool] = useState<Recommendation[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPool = useCallback(async (destination: string): Promise<Recommendation[]> => {
    const response = await fetch(`/api/places?destination=${encodeURIComponent(destination)}`);
    if (!response.ok) throw new Error("Could not load places");
    const { places } = (await response.json()) as { places: Recommendation[] };
    return places;
  }, []);

  // Bring back the trip from a previous visit, but only once the pool its edits depend on is
  // in hand — restoring a trip you can't yet edit would be worse than a moment of the form.
  useEffect(() => {
    const saved = load();
    if (!saved) return;

    fetchPool(saved.prefs.destination)
      .then((places) => {
        setPool(places);
        setTrip(saved);
      })
      .catch(() => setError("We couldn't reload your saved trip. Starting fresh."));
  }, [fetchPool]);

  async function create(prefs: TripPrefs) {
    setBusy(true);
    setError(null);
    try {
      const places = await fetchPool(prefs.destination);
      const built = buildTrip(places, prefs);
      setPool(places);
      setTrip(built);
      save(built);
    } catch {
      setError("Something went wrong building the trip. Try again?");
    } finally {
      setBusy(false);
    }
  }

  function update(next: Trip) {
    setTrip(next);
    save(next);
  }

  function restart() {
    setTrip(null);
    setPool([]);
    save(null);
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="rounded-xl border border-terracotta/30 bg-terracotta/5 px-4 py-3 text-sm text-ink-soft">
          {error}
        </p>
      )}

      {trip ? (
        <TripView trip={trip} pool={pool} onChange={update} onRestart={restart} />
      ) : (
        <TripSetup onCreate={create} busy={busy} />
      )}
    </div>
  );
}
