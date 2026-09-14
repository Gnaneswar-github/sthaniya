"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHero } from "./PageHero";
import { TripView } from "./TripView";
import { decodeTrip } from "@/lib/share";
import { saveTrip } from "@/lib/trip-storage";
import type { Recommendation, Trip } from "@/lib/types";

type State = { status: "loading" } | { status: "missing" } | { status: "ready"; trip: Trip; pool: Recommendation[] };

/**
 * Opens a trip someone shared. The trip lives in the link itself, so this works without an
 * account; saving copies it onto this device, where it can be edited like any other.
 */
export function SharedTrip() {
  const router = useRouter();
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    const match = /(?:^#|&)t=([^&]+)/.exec(window.location.hash);
    let live = true;
    (match ? decodeTrip(match[1]) : Promise.resolve(null)).then((shared) => {
      if (!live) return;
      if (!shared) {
        setState({ status: "missing" });
        return;
      }
      const used = shared.trip.days.flatMap((d) => d.items.map((i) => i.place));
      const pool = [...new Map([...used, ...shared.pool].map((p) => [p.id, p])).values()];
      setState({ status: "ready", trip: shared.trip, pool });
    });
    return () => {
      live = false;
    };
  }, []);

  if (state.status === "loading") {
    return <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-24 text-center text-ink-faint">Opening the trip…</main>;
  }

  if (state.status === "missing") {
    return (
      <>
        <PageHero phase="dusk" title="This link didn't open" subtitle="It may have been cut short when it was copied. Ask for it again, or plan your own." />
        <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-10 text-center">
          <button type="button" onClick={() => router.push("/")} className="rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-deep">
            Plan a trip
          </button>
        </main>
      </>
    );
  }

  const { trip, pool } = state;
  return (
    <>
      <PageHero
        phase="dawn"
        title={trip.prefs.destination}
        subtitle={`${trip.days.length} ${trip.days.length === 1 ? "day" : "days"}, ${trip.days.flatMap((d) => d.items).length} stops. Save it to make it yours.`}
      />
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-5 px-5 py-8">
        <div className="no-print flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-brand/25 bg-brand/5 px-5 py-4">
          <p className="text-sm text-ink-soft">Someone shared this trip with you. Changes you make stay on this device.</p>
          <button
            type="button"
            onClick={() => {
              saveTrip({ trip, pool, meta: null });
              router.push("/plan");
            }}
            className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-deep"
          >
            Save to my trips
          </button>
        </div>
        <TripView
          trip={trip}
          pool={pool}
          onChange={(next) => setState({ status: "ready", trip: next, pool })}
          onRestart={() => router.push("/")}
        />
      </main>
    </>
  );
}
