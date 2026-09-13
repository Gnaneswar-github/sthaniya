"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { PageHero } from "./PageHero";
import { PlaceArt } from "./PlaceArt";
import { TripView } from "./TripView";
import { Understanding } from "./Understanding";
import { useCurrency } from "./currency/CurrencyProvider";
import { destinationByName, extractFor } from "@/lib/destinations/curation";
import type { DraftMeta, GenerateEvent } from "@/lib/generate-events";
import { parseIntent, type ParsedIntent } from "@/lib/parse-intent";
import { readTaste } from "@/lib/taste";
import { buildTrip, usedPlaceIds } from "@/lib/trip-engine";
import { clearTrip, loadTrip, saveTrip } from "@/lib/trip-storage";
import { CATEGORIES, type Photo, type Recommendation, type Trip, type TripPrefs } from "@/lib/types";

type Stage = {
  step: "locating" | "mapping" | "choosing" | "retrying";
  destination?: string;
  candidates?: number;
};

/**
 * Everything the parser missed falls back to a default the UI flags as a guess. The currency
 * falls back to whatever the traveller is browsing in — never to a fixed one.
 */
function toPrefs(intent: ParsedIntent, raw: string, displayCurrency: string): TripPrefs {
  const days = intent.durationDays?.value ?? 3;

  // A named month moves the trip there; otherwise it starts tomorrow.
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

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Reads the NDJSON event stream from /api/generate, calling back once per event. */
async function readDraftStream(prefs: TripPrefs, onEvent: (event: GenerateEvent) => void) {
  const response = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(prefs),
  });

  if (!response.body || !(response.headers.get("content-type") ?? "").includes("ndjson")) {
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    onEvent({ type: "error", error: data.error ?? "We couldn't start drafting that trip.", retryable: response.status >= 500 });
    return;
  }

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    let newline: number;
    while ((newline = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (!line) continue;
      try {
        onEvent(JSON.parse(line) as GenerateEvent);
      } catch {
        // A partial or malformed line is skipped.
      }
    }
  }
}

const withPhotos = (places: Recommendation[], photos: Record<string, Photo>) =>
  places.map((p) => (photos[p.id] && !p.photo ? { ...p, photo: photos[p.id] } : p));

export function PlanFlow({ query }: { query: string }) {
  const { currency } = useCurrency();
  const intent = useMemo(() => parseIntent(query), [query]);
  const [prefs, setPrefs] = useState<TripPrefs>(() => toPrefs(intent, query, currency));
  const [trip, setTrip] = useState<Trip | null>(null);
  const [pool, setPool] = useState<Recommendation[]>([]);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<Stage | null>(null);
  const [live, setLive] = useState<Recommendation[]>([]);
  const [drafted, setDrafted] = useState<DraftMeta | null>(null);
  const [error, setError] = useState<string | null>(null);

  const readFrom = {
    destination: intent.destination?.matched,
    startDate: intent.month ? `${intent.month.matched} · ${intent.durationDays?.matched ?? ""}`.trim() : intent.durationDays?.matched,
    travellerType: intent.travellerType?.matched,
    interests: intent.interests[0]?.matched,
    dial: intent.dial?.matched,
    pace: intent.pace?.matched,
    budgetPerDay: intent.budgetPerDay?.matched,
  };

  /** Real photos arrive after the trip is on screen, so they never slow it down. */
  const attachPhotos = useCallback(async (current: Trip, places: Recommendation[]) => {
    const used = usedPlaceIds(current);
    const needing = places
      .filter((p) => !p.photo)
      .sort((a, b) => Number(used.has(b.id)) - Number(used.has(a.id)))
      .slice(0, 40)
      .map((p) => ({ id: p.id, name: p.name, coords: p.coords, wikidata: p.wikidata, wikipedia: p.wikipedia }));
    if (needing.length === 0) return;

    try {
      const response = await fetch("/api/photos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ places: needing }),
      });
      if (!response.ok) return;
      const { photos } = (await response.json()) as { photos: Record<string, Photo> };
      if (Object.keys(photos).length === 0) return;

      setPool((existing) => withPhotos(existing, photos));
      setTrip((existing) =>
        existing
          ? {
              ...existing,
              days: existing.days.map((day) => ({
                ...day,
                items: day.items.map((item) =>
                  photos[item.place.id] && !item.place.photo ? { ...item, place: { ...item.place, photo: photos[item.place.id] } } : item,
                ),
              })),
            }
          : existing,
      );
    } catch {
      // Photos are a nicety; the generated artwork stays in place.
    }
  }, []);

  // Restore the traveller's trip when they come back without a new sentence.
  useEffect(() => {
    if (query) return;
    const stored = loadTrip();
    if (!stored) return;
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      setTrip(stored.trip);
      setPool(stored.pool);
      setPrefs(stored.trip.prefs);
      setDrafted(stored.meta);
      void attachPhotos(stored.trip, stored.pool);
    });
    return () => {
      cancelled = true;
    };
  }, [query, attachPhotos]);

  // Every change — edits, arriving photos — is kept on this device.
  useEffect(() => {
    if (trip) saveTrip({ trip, pool, meta: drafted });
  }, [trip, pool, drafted]);

  function finish(places: Recommendation[], meta: DraftMeta | null) {
    const built = buildTrip(places, { ...prefs, taste: readTaste() });
    setPool(places);
    setTrip(built);
    setDrafted(meta);
    void attachPhotos(built, places);
  }

  async function build() {
    if (!prefs.destination.trim()) {
      setError("Tell us where you're going and we'll take it from there.");
      return;
    }
    setBusy(true);
    setError(null);
    setDrafted(null);
    setLive([]);

    try {
      // Hand-checked places first — they're better, and checking costs nothing.
      const verifiedResponse = await fetch(`/api/places?destination=${encodeURIComponent(prefs.destination)}`);
      const verified = verifiedResponse.ok ? ((await verifiedResponse.json()) as { places: Recommendation[] }).places : [];
      if (verified.length > 0) {
        finish(verified, null);
        return;
      }

      setStage({ step: "locating", destination: prefs.destination });
      for (let attempt = 0; attempt < 2; attempt++) {
        const run = { places: [] as Recommendation[], meta: null as DraftMeta | null, failure: null as { error: string; retryable: boolean } | null };

        await readDraftStream({ ...prefs, taste: readTaste() }, (event) => {
          if (event.type === "stage") {
            setStage({ step: event.stage, destination: event.destination ?? prefs.destination, candidates: event.candidates });
          } else if (event.type === "place") {
            run.places.push(event.place);
            setLive([...run.places]);
          } else if (event.type === "done") {
            run.meta = event.meta;
          } else {
            run.failure = event;
          }
        });

        if (run.places.length > 0) {
          finish(run.places, run.meta);
          return;
        }
        if (run.failure?.retryable && attempt === 0) {
          setStage((current) => ({ ...(current ?? {}), step: "retrying" }));
          await wait(4000);
          continue;
        }
        setError(run.failure?.error ?? `We couldn't put together a trip for ${prefs.destination}.`);
        return;
      }
    } catch {
      setError("Something went wrong building the trip. Try again?");
    } finally {
      setBusy(false);
      setStage(null);
    }
  }

  function discard() {
    setTrip(null);
    setPool([]);
    setLive([]);
    clearTrip();
  }

  if (trip) {
    const empty = trip.days.every((day) => day.items.length === 0);
    if (empty) return <RefineTrip destination={trip.prefs.destination} onBack={discard} />;

    const nights = trip.days.length;
    return (
      <>
        <PageHero
          phase="dawn"
          eyebrow="Your trip"
          title={trip.prefs.destination}
          subtitle={`${nights} ${nights === 1 ? "day" : "days"}, ${trip.days.flatMap((d) => d.items).length} stops — and every one of them is yours to change.`}
        />
        <main className="mx-auto w-full max-w-6xl flex-1 space-y-5 px-5 py-8">
          <TripView trip={trip} pool={pool} onChange={setTrip} onRestart={discard} />
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

        {!stage && <Understanding prefs={prefs} readFrom={readFrom} avoid={intent.avoid} onChange={setPrefs} />}

        {error && <p className="rounded-2xl border border-brand/30 bg-brand/5 px-4 py-3 text-sm text-ink-soft">{error}</p>}

        {stage ? (
          <DraftingProgress stage={stage} places={live} destination={stage.destination ?? prefs.destination} />
        ) : (
          <button
            type="button"
            onClick={build}
            disabled={busy}
            className="w-full rounded-full bg-brand px-5 py-4 font-semibold text-white shadow-[0_18px_40px_-20px_rgba(21,121,90,0.8)] transition enabled:hover:-translate-y-0.5 enabled:hover:bg-brand-bright disabled:opacity-60"
          >
            {busy ? "Building your trip…" : "Build my trip"}
          </button>
        )}
      </main>
    </>
  );
}

/**
 * What the traveller sees while a trip is drafted: the real steps, then each stop the moment it
 * is chosen. Waiting feels shorter when something is visibly happening — and here it genuinely is.
 */
function DraftingProgress({ stage, places, destination }: { stage: Stage; places: Recommendation[]; destination: string }) {
  const steps = [
    { id: "locating", label: `Finding ${destination}` },
    { id: "mapping", label: "Reading the map" },
    { id: "choosing", label: stage.candidates ? `Choosing from ${stage.candidates} places` : "Choosing your stops" },
  ] as const;
  const current = stage.step === "retrying" ? 2 : steps.findIndex((s) => s.id === stage.step);

  return (
    <section aria-live="polite" className="rise overflow-hidden rounded-3xl border border-line bg-paper-raised shadow-[0_24px_60px_-40px_rgba(13,47,66,0.5)]">
      <ol className="grid grid-cols-3 border-b border-line">
        {steps.map((step, index) => {
          const done = index < current || (index === current && places.length > 0 && index === 2);
          const activeStep = index === current;
          return (
            <li key={step.id} className={`flex items-center gap-2 px-3 py-3 text-xs sm:px-4 ${activeStep ? "text-ink" : done ? "text-brand" : "text-ink-faint"}`}>
              <span
                className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold ${
                  done ? "bg-brand text-white" : activeStep ? "animate-pulse bg-gold-bright text-deep" : "bg-paper-sunken"
                }`}
              >
                {done ? "✓" : index + 1}
              </span>
              <span className="truncate font-medium">{step.label}</span>
            </li>
          );
        })}
      </ol>

      {stage.step === "retrying" && (
        <p className="border-b border-line bg-gold/5 px-4 py-2.5 text-xs text-ink-soft">The drafter is busy — trying again in a moment…</p>
      )}

      <ul className="divide-y divide-line">
        {places.map((place) => (
          <li key={place.id} className="flex animate-[fade-up_0.45s_ease_both] items-center gap-3 px-4 py-3">
            <PlaceArt name={place.name} category={place.category} glyphSize={48} className="h-12 w-12 shrink-0 rounded-xl" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-display text-lg leading-tight text-ink">{place.name}</span>
              <span className="block truncate text-xs text-ink-faint">
                {CATEGORIES[place.category]} · {place.vibe}
              </span>
            </span>
          </li>
        ))}
        {Array.from({ length: places.length === 0 ? 3 : 1 }, (_, i) => (
          <li key={`skeleton-${i}`} className="flex items-center gap-3 px-4 py-3" aria-hidden>
            <span className="shimmer h-12 w-12 shrink-0 rounded-xl" />
            <span className="flex-1 space-y-2">
              <span className="shimmer block h-3.5 w-1/2 rounded" />
              <span className="shimmer block h-3 w-1/3 rounded" />
            </span>
          </li>
        ))}
      </ul>

      <p className="border-t border-line px-4 py-3 text-xs text-ink-faint">
        {places.length > 0 ? `${places.length} stops chosen so far — ` : ""}every stop is a real place on the map.
      </p>
    </section>
  );
}

/**
 * A quiet credit under the trip rather than a warning above it. The map data is OpenStreetMap's,
 * whose licence asks for attribution, and a nudge to check hours is simply good travel advice.
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
      Places from {source}. Photos from Wikimedia Commons, credited on each. Weather by Open-Meteo. Opening hours shift with the
      seasons, so it&rsquo;s worth a quick look before you head out.
    </p>
  );
}

function RefineTrip({ destination, onBack }: { destination: string; onBack: () => void }) {
  const sourced = destinationByName(destination);

  return (
    <>
      <PageHero
        phase="dusk"
        eyebrow="Let's refine"
        title={destination}
        subtitle="A couple of small changes and your trip will start taking shape."
      />

      <main className="mx-auto w-full max-w-3xl flex-1 space-y-5 px-5 py-8">
        <section className="rounded-3xl border border-gold/40 bg-gold/5 p-5 sm:p-7">
          <h2 className="font-display text-2xl leading-tight text-ink sm:text-3xl">Let&rsquo;s shape {destination} a little differently</h2>
          <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
            Try adding an interest or two, or name a nearby town or neighbourhood. The more you give us to go on, the more we can
            build around it.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={onBack} className="rounded-xl bg-ink px-5 py-3 text-sm font-medium text-paper transition hover:bg-brand">
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
                <Image src={sourced.thumbnailUrl} alt={sourced.name} fill sizes="(max-width: 768px) 100vw, 768px" className="object-cover" />
              </div>
            )}
            <div className="space-y-2 p-5 sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">A little about the place</p>
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
