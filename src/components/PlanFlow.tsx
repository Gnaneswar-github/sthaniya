"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { PageHero } from "./PageHero";
import { TripView } from "./TripView";
import { Understanding } from "./Understanding";
import { useCurrency } from "./currency/CurrencyProvider";
import { destinationByName, extractFor } from "@/lib/destinations/curation";
import { parseIntent, type ParsedIntent } from "@/lib/parse-intent";
import { buildTrip } from "@/lib/trip-engine";
import type { Recommendation, Trip, TripPrefs } from "@/lib/types";

const STORAGE_KEY = "sthaniya.trip.v3";

type DraftMeta = {
  destination: string;
  country: string | null;
  candidatesConsidered: number;
  inventedPlacesRejected: number;
  model: string;
  source: string;
};

/**
 * Everything the parser missed falls back to a default the UI flags as a guess. The currency
 * falls back to whatever the traveller is browsing in — never to a fixed one.
 */
function toPrefs(intent: ParsedIntent, raw: string, displayCurrency: string): TripPrefs {
  const days = intent.durationDays?.value ?? 3;

  // A named month moves the trip there; otherwise it starts tomorrow. Season-aware planning
  // is only real if "in April" actually lands in April.
  const start = intent.month
    ? new Date(Date.UTC(intent.month.year, intent.month.month, 1))
    : new Date(Date.now() + 86_400_000);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + Math.max(0, days - 1));

  return {
    destination: intent.destination?.value ?? "",
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
    travellerType: intent.travellerType?.value ?? "solo",
    interests: intent.interests.length > 0 ? intent.interests.map((i) => i.value) : ["food", "local_life"],
    dial: intent.dial?.value ?? "local",
    pace: intent.pace?.value ?? "balanced",
    budgetPerDay: intent.budgetPerDay?.value ?? 0,
    budgetCurrency: intent.budgetPerDay?.currency ?? displayCurrency,
    notes: raw,
  };
}

export function PlanFlow({ query }: { query: string }) {
  const { currency } = useCurrency();
  const intent = useMemo(() => parseIntent(query), [query]);
  const [prefs, setPrefs] = useState<TripPrefs>(() => toPrefs(intent, query, currency));
  const [trip, setTrip] = useState<Trip | null>(null);
  const [pool, setPool] = useState<Recommendation[]>([]);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<"idle" | "drafting">("idle");
  const [drafted, setDrafted] = useState<DraftMeta | null>(null);
  const [error, setError] = useState<string | null>(null);

  const readFrom = {
    destination: intent.destination?.matched,
    startDate: intent.month
      ? `${intent.month.matched} · ${intent.durationDays?.matched ?? ""}`.trim()
      : intent.durationDays?.matched,
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
    setDrafted(null);

    try {
      // Verified data first — it's better, and it costs nothing to check.
      let places = await fetchPool(prefs.destination);
      let meta: DraftMeta | null = null;

      if (places.length === 0) {
        setStage("drafting");
        type Drafted = { places?: Recommendation[]; meta?: DraftMeta; error?: string };
        const draft = async () => {
          const res = await fetch("/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(prefs),
          });
          return { res, body: (await res.json().catch(() => ({}))) as Drafted };
        };

        // A busy upstream is usually clear a few seconds later. Trying once more on the
        // traveller's behalf beats handing them an error they'd just retry themselves.
        let { res: response, body: data } = await draft();
        if (response.status === 502 || response.status === 503 || response.status === 504) {
          await new Promise((resolve) => setTimeout(resolve, 5000));
          ({ res: response, body: data } = await draft());
        }

        if (!response.ok || !data.places?.length) {
          setError(data.error ?? `We couldn't put together a trip for ${prefs.destination}.`);
          return;
        }
        places = data.places;
        meta = data.meta ?? null;
      }

      const built = buildTrip(places, prefs);
      setPool(places);
      setTrip(built);
      setDrafted(meta);
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(built));
      } catch {
        // Not fatal — the trip simply won't survive a reload.
      }
    } catch {
      setError("Something went wrong building the trip. Try again?");
    } finally {
      setBusy(false);
      setStage("idle");
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
    // A dashboard of zeroes helps nobody. With nothing to build from, offer a way forward and
    // what we do know about the place.
    const empty = trip.days.every((day) => day.items.length === 0);
    if (empty) {
      return <RefineTrip destination={trip.prefs.destination} onBack={discard} />;
    }

    const nights = trip.days.length;
    return (
      <>
        <PageHero
          phase="dawn"
          eyebrow="Your trip"
          title={trip.prefs.destination}
          subtitle={`${nights} ${nights === 1 ? "day" : "days"}, ${trip.days.flatMap((d) => d.items).length} stops — and every one of them is yours to change.`}
        />
        <main className="mx-auto w-full max-w-3xl flex-1 space-y-5 px-5 py-8">
          <TripView trip={trip} pool={pool} onChange={update} onRestart={discard} />
          {drafted && <SourceCredit meta={drafted} />}
        </main>
      </>
    );
  }

  return (
    <>
      <PageHero
        phase="golden"
        eyebrow="Step two"
        title="Here's what we"
        accent="understood."
        subtitle="Every field below shows the words it came from. Change anything that's wrong — the trip is built from these, not from the sentence."
      />

      <main className="mx-auto w-full max-w-3xl flex-1 space-y-5 px-5 py-8">
        {query && (
          <blockquote className="rise rounded-2xl border-l-2 border-gold bg-paper-raised px-4 py-3 text-[15px] leading-relaxed text-ink-soft">
            &ldquo;{query}&rdquo;
          </blockquote>
        )}

        <Understanding prefs={prefs} readFrom={readFrom} avoid={intent.avoid} onChange={setPrefs} />

        {error && (
          <p className="rounded-xl border border-brand/30 bg-brand/5 px-4 py-3 text-sm text-ink-soft">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={build}
          disabled={busy}
          className="w-full rounded-full bg-brand px-5 py-4 font-semibold text-white transition enabled:hover:bg-brand-bright disabled:opacity-60"
        >
          {stage === "drafting"
            ? "Reading the map, then drafting…"
            : busy
              ? "Building your trip…"
              : "Build my trip"}
        </button>

        {stage === "drafting" && (
          <p className="text-center text-xs leading-relaxed text-ink-faint">
            We&rsquo;re pulling real, mapped places around {prefs.destination}, then asking a
            model to shape a trip from them — it may only use places that actually exist.
            Usually ten seconds, occasionally closer to thirty when the map server is busy.
          </p>
        )}
      </main>
    </>
  );
}

/**
 * A quiet credit under the trip rather than a warning above it. Nobody has walked every street
 * of every city, and a traveller doesn't need telling. The map data is OpenStreetMap's, whose
 * licence asks for attribution, and a nudge to check hours is simply good travel advice.
 */
function SourceCredit({ meta }: { meta: DraftMeta }) {
  const source =
    meta.source === "wikipedia"
      ? "Wikipedia"
      : meta.source === "openstreetmap+wikipedia"
        ? "© OpenStreetMap contributors and Wikipedia"
        : "© OpenStreetMap contributors";

  return (
    <p className="pt-2 text-center text-xs leading-relaxed text-ink-faint">
      Places from {source}. Opening hours shift with the seasons, so it&rsquo;s worth a quick look
      before you head out.
    </p>
  );
}

function RefineTrip({ destination, onBack }: { destination: string; onBack: () => void }) {
  const sourced = destinationByName(destination);

  return (
    <>
      {/* Dusk: a pause in the cycle, with a way forward rather than an apology. */}
      <PageHero
        phase="dusk"
        eyebrow="Let's refine"
        title={destination}
        subtitle="A couple of small changes and your trip will start taking shape."
      />

      <main className="mx-auto w-full max-w-3xl flex-1 space-y-5 px-5 py-8">
      <section className="rounded-3xl border border-gold/40 bg-gold/5 p-5 sm:p-7">
        <h2 className="font-display text-2xl leading-tight text-ink sm:text-3xl">
          Let&rsquo;s shape {destination} a little differently
        </h2>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
          Try adding an interest or two, or name a nearby town or neighbourhood. The more you
          give us to go on, the more we can build around it.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onBack}
            className="rounded-xl bg-ink px-5 py-3 text-sm font-medium text-paper transition hover:bg-brand"
          >
            Edit my preferences
          </button>
          <Link
            href="/"
            className="rounded-xl border border-line-strong px-4 py-3 text-sm text-ink-soft transition hover:border-brand hover:text-brand"
          >
            Explore destinations
          </Link>
        </div>
      </section>

      {sourced && (
        <section className="overflow-hidden rounded-3xl border border-line bg-paper-raised">
          {sourced.thumbnailUrl && (
            <div className="relative aspect-[16/9] sm:aspect-[21/9]">
              <Image
                src={sourced.thumbnailUrl}
                alt={sourced.name}
                fill
                sizes="(max-width: 768px) 100vw, 768px"
                className="object-cover"
              />
            </div>
          )}
          <div className="space-y-2 p-5 sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
              A little about the place
            </p>
            <h3 className="font-display text-2xl text-ink">{sourced.name}</h3>
            <p className="text-[15px] leading-relaxed text-ink-soft">{extractFor(sourced)}</p>
            <p className="pt-1 text-[11px] text-ink-faint">
              Summary from Wikipedia
              {sourced.thumbnailCredit && ` · Photo: ${sourced.thumbnailCredit}`}
            </p>
          </div>
        </section>
      )}
      </main>
    </>
  );
}
