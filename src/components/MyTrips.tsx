"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "./AuthProvider";
import { deleteCloudTrip, listMyTrips, type CloudTripSummary } from "@/lib/cloud-trips";

/** "2 Nov – 6 Nov 2026", in the reader's own date style. */
function dateRange(start: string, end: string) {
  const format = (iso: string, withYear: boolean) =>
    new Date(`${iso}T12:00:00Z`).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      ...(withYear ? { year: "numeric" } : {}),
      timeZone: "UTC",
    });
  return `${format(start, false)} – ${format(end, true)}`;
}

export function MyTrips() {
  const { user, ready, available } = useAuth();
  const [trips, setTrips] = useState<CloudTripSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let live = true;
    listMyTrips()
      .then((rows) => {
        if (live) setTrips(rows);
      })
      .catch((e: unknown) => {
        if (live) setError(e instanceof Error ? e.message : "Couldn't load your trips.");
      });
    return () => {
      live = false;
    };
  }, [user]);

  if (!available) return <p className="text-ink-soft">Accounts aren&rsquo;t switched on for this deployment yet.</p>;
  if (!ready) return <p className="text-ink-faint">Checking your session…</p>;
  if (!user) {
    return (
      <div className="rounded-3xl border border-line bg-paper-raised p-8 text-center">
        <h2 className="font-display text-2xl text-ink">Sign in to see your trips</h2>
        <p className="mt-2 text-sm text-ink-soft">Trips you save to your account follow you to every device.</p>
        <Link href="/account?next=/trips" className="mt-5 inline-block rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-deep">
          Sign in or create an account
        </Link>
      </div>
    );
  }
  if (error) return <p className="rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>;
  if (!trips) {
    return (
      <ul className="grid gap-3 sm:grid-cols-2" aria-label="Loading your trips">
        {[0, 1].map((i) => (
          <li key={i} className="space-y-2 rounded-3xl border border-line bg-paper-raised p-5">
            <span className="shimmer block h-5 w-2/3 rounded" />
            <span className="shimmer block h-3 w-1/2 rounded" />
          </li>
        ))}
      </ul>
    );
  }

  if (trips.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-line-strong p-10 text-center">
        <h2 className="font-display text-2xl text-ink">No saved trips yet</h2>
        <p className="mt-2 text-sm text-ink-soft">Build a trip, then tap &ldquo;Save to my account&rdquo; — it&rsquo;ll appear here.</p>
        <Link href="/" className="mt-5 inline-block rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-deep">
          Plan a trip
        </Link>
      </div>
    );
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {trips.map((trip) => {
        const shared = trip.owner_id !== user.id;
        return (
          <li key={trip.id} className="lift flex items-center justify-between gap-3 rounded-3xl border border-line bg-paper-raised p-5">
            <Link href={`/trips/${trip.id}`} className="min-w-0 flex-1">
              <span className="block truncate font-display text-xl text-ink">{trip.title}</span>
              <span className="mt-0.5 block text-xs text-ink-faint">
                {trip.prefs ? `${dateRange(trip.prefs.startDate, trip.prefs.endDate)} · ` : ""}
                {shared ? "Shared with you" : "Yours"} · edited{" "}
                {new Date(trip.updated_at).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
              </span>
            </Link>
            {!shared && (
              <button
                type="button"
                onClick={async () => {
                  if (!window.confirm(`Delete “${trip.title}” for everyone on it? This can't be undone.`)) return;
                  await deleteCloudTrip(trip.id);
                  setTrips((current) => (current ?? []).filter((t) => t.id !== trip.id));
                }}
                className="shrink-0 rounded-full border border-line px-3.5 py-2 text-xs text-ink-soft transition hover:border-danger hover:text-danger"
              >
                Delete
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
