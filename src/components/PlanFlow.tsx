"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { CheckIcon } from "./icons";
import { PageHero } from "./PageHero";
import { PlaceArt } from "./PlaceArt";
import { TripView } from "./TripView";
import { Understanding } from "./Understanding";
import { useCurrency } from "./currency/CurrencyProvider";
import { track } from "@/lib/analytics";
import { createCloudTrip } from "@/lib/cloud-trips";
import { destinationByName, extractFor } from "@/lib/destinations/curation";
import type { DraftMeta, GenerateEvent } from "@/lib/generate-events";
import { legDates, mergeLegTrips, withLegs } from "@/lib/legs";
import { parseIntent, type ParsedIntent } from "@/lib/parse-intent";
import { readTaste } from "@/lib/taste";
import { buildTrip, usedPlaceIds } from "@/lib/trip-engine";
import { clearTrip, loadTrip, saveTrip } from "@/lib/trip-storage";
import { CATEGORIES, type Photo, type PlaceDetails, type Recommendation, type Trip, type TripPrefs } from "@/lib/types";

type Stage = {
  step: "locating" | "mapping" | "choosing" | "retrying";
  destination?: string;
  candidates?: number;
  /** "City 2 of 3" on multi-city trips. */
  label?: string;
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

  const base: TripPrefs = {
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

  return intent.legs ? withLegs(base, intent.legs.map(({ destination, days: d }) => ({ destination, days: d }))) : base;
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

/** Applies a change to every copy of a place — in the pool and in the trip's days. */
const patchTrip = (trip: Trip | null, update: (place: Recommendation) => Recommendation): Trip | null =>
  trip
    ? { ...trip, days: trip.days.map((day) => ({ ...day, items: day.items.map((item) => ({ ...item, place: update(item.place) })) })) }
    : trip;

export function PlanFlow({ query }: { query: string }) {
  const { currency } = useCurrency();
  const { user, available: accountsAvailable } = useAuth();
  const router = useRouter();
  const intent = useMemo(() => parseIntent(query), [query]);
  const [prefs, setPrefs] = useState<TripPrefs>(() => toPrefs(intent, query, currency));
  const [trip, setTrip] = useState<Trip | null>(null);
  const [pool, setPool] = useState<Recommendation[]>([]);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<Stage | null>(null);
  const [live, setLive] = useState<Recommendation[]>([]);
  const [drafted, setDrafted] = useState<DraftMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accountState, setAccountState] = useState<"idle" | "saving" | "saved" | "signin">("idle");

  const readFrom = {
    destination: intent.legs ? intent.legs.map((l) => l.matched).join(" · ") : intent.destination?.matched,
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
      const update = (place: Recommendation) => (photos[place.id] && !place.photo ? { ...place, photo: photos[place.id] } : place);
      setPool((existing) => existing.map(update));
      setTrip((existing) => patchTrip(existing, update));
    } catch {
      // Photos are a nicety; the generated artwork stays in place.
    }
  }, []);

  /** Google ratings and hours, when Apify is configured. Silent otherwise. */
  const attachDetails = useCallback(async (current: Trip) => {
    const stops = current.days
      .flatMap((d) => d.items.map((i) => i.place))
      .filter((p) => !p.details)
      .slice(0, 12)
      .map((p) => ({ id: p.id, name: p.name, destination: p.destination, coords: p.coords }));
    if (stops.length === 0) return;

    try {
      const response = await fetch("/api/place-details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ places: stops }),
      });
      if (!response.ok) return;
      const { configured, details } = (await response.json()) as { configured: boolean; details: Record<string, PlaceDetails> };
      if (!configured || Object.keys(details).length === 0) return;
      const update = (place: Recommendation) => (details[place.id] ? { ...place, details: details[place.id] } : place);
      setPool((existing) => existing.map(update));
      setTrip((existing) => patchTrip(existing, update));
    } catch {
      // Ratings are a nicety too.
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
      void attachDetails(stored.trip);
    });
    return () => {
      cancelled = true;
    };
  }, [query, attachPhotos, attachDetails]);

  // Every change — edits, arriving photos — is kept on this device.
  useEffect(() => {
    if (trip) saveTrip({ trip, pool, meta: drafted });
  }, [trip, pool, drafted]);

  function commit(built: Trip, places: Recommendation[], meta: DraftMeta | null) {
    setPool(places);
    setTrip(built);
    setDrafted(meta);
    setAccountState("idle");
    track("trip_built", {
      days: built.days.length,
      stops: built.days.flatMap((d) => d.items).length,
      cities: new Set(built.days.map((d) => d.destination ?? built.prefs.destination)).size,
      drafted: meta !== null,
    });
    void attachPhotos(built, places);
    void attachDetails(built);
  }

  /** Places for one destination: hand-checked ones if we have them, otherwise drafted live. */
  async function placesFor(legPrefs: TripPrefs, label?: string) {
    const verifiedResponse = await fetch(`/api/places?destination=${encodeURIComponent(legPrefs.destination)}`);
    const verified = verifiedResponse.ok ? ((await verifiedResponse.json()) as { places: Recommendation[] }).places : [];
    if (verified.length > 0) {
      setLive((current) => [...current, ...verified.slice(0, 6)]);
      return { places: verified, meta: null as DraftMeta | null, error: null as string | null };
    }

    setStage({ step: "locating", destination: legPrefs.destination, label });
    for (let attempt = 0; attempt < 2; attempt++) {
      const run = { places: [] as Recommendation[], meta: null as DraftMeta | null, failure: null as { error: string; retryable: boolean } | null };

      await readDraftStream({ ...legPrefs, taste: readTaste() }, (event) => {
        if (event.type === "stage") {
          setStage({ step: event.stage, destination: event.destination ?? legPrefs.destination, candidates: event.candidates, label });
        } else if (event.type === "place") {
          run.places.push(event.place);
          setLive((current) => [...current, event.place]);
        } else if (event.type === "done") {
          run.meta = event.meta;
        } else {
          run.failure = event;
        }
      });

      if (run.places.length > 0) return { places: run.places, meta: run.meta, error: null };
      if (run.failure?.retryable && attempt === 0) {
        setStage((current) => ({ ...(current ?? {}), step: "retrying", label }));
        await wait(4000);
        continue;
      }
      return { places: [], meta: null, error: run.failure?.error ?? `We couldn't put together a trip for ${legPrefs.destination}.` };
    }
    return { places: [], meta: null, error: `We couldn't put together a trip for ${legPrefs.destination}.` };
  }

  async function build() {
    const route = prefs.legs && prefs.legs.length > 1 ? legDates(prefs) : null;
    if (route ? route.some((leg) => !leg.destination.trim()) : !prefs.destination.trim()) {
      setError(route ? "Choose a city for every stop on the route." : "Tell us where you're going and we'll take it from there.");
      return;
    }
    setBusy(true);
    setError(null);
    setDrafted(null);
    setLive([]);

    try {
      if (!route) {
        const result = await placesFor(prefs);
        if (result.places.length === 0) {
          setError(result.error);
          track("trip_draft_failed");
          return;
        }
        commit(buildTrip(result.places, { ...prefs, taste: readTaste() }), result.places, result.meta);
        return;
      }

      const parts: { destination: string; trip: Trip }[] = [];
      const everything: Recommendation[] = [];
      const missed: string[] = [];
      let meta: DraftMeta | null = null;

      for (const [index, leg] of route.entries()) {
        const legPrefs: TripPrefs = { ...prefs, destination: leg.destination, startDate: leg.startDate, endDate: leg.endDate, legs: undefined };
        const result = await placesFor(legPrefs, `City ${index + 1} of ${route.length}`);
        if (result.places.length === 0) missed.push(leg.destination);
        parts.push({ destination: leg.destination, trip: buildTrip(result.places, { ...legPrefs, taste: readTaste() }) });
        everything.push(...result.places);
        meta ??= result.meta;
      }

      if (everything.length === 0) {
        setError("We couldn't put this route together just now. Try again in a moment?");
        track("trip_draft_failed", { cities: route.length });
        return;
      }

      const merged = mergeLegTrips(prefs, parts);
      if (missed.length > 0) {
        merged.notes.unshift(`${missed.join(" and ")} ${missed.length === 1 ? "is" : "are"} left as open days to explore — try again later for suggestions there.`);
      }
      commit(merged, everything, meta);
    } catch {
      setError("Something went wrong building the trip. Try again?");
    } finally {
      setBusy(false);
      setStage(null);
    }
  }

  async function saveToAccount() {
    if (!trip) return;
    if (!user) {
      setAccountState("signin");
      router.push(`/account?next=${encodeURIComponent("/plan")}`);
      return;
    }
    setAccountState("saving");
    try {
      const id = await createCloudTrip({ trip, pool, meta: drafted });
      track("trip_saved");
      setAccountState("saved");
      router.push(`/trips/${id}`);
    } catch {
      setAccountState("idle");
      setError("We couldn't save this trip to your account just now. It's still saved on this device.");
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
          title={trip.prefs.destination}
          subtitle={`${nights} ${nights === 1 ? "day" : "days"}, ${trip.days.flatMap((d) => d.items).length} stops — and every one of them is yours to change.`}
        />
        <main className="mx-auto w-full max-w-6xl flex-1 space-y-5 px-5 py-8">
          {error && <p role="alert" className="rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}
          <TripView
            trip={trip}
            pool={pool}
            onChange={setTrip}
            onRestart={discard}
            onSaveToAccount={accountsAvailable ? saveToAccount : undefined}
            accountState={accountState}
          />
          {drafted && <SourceCredit meta={drafted} />}
        </main>
      </>
    );
  }

  return (
    <>
      <PageHero
        phase="golden"
        title="Here's what we"
        accent="understood."
        subtitle="Every field below shows the words it came from. Change anything that's wrong — the trip is built from these, not from the sentence."
      />

      <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-5 py-8">
        {query && (
          <blockquote className="rise text-balance px-1 font-display text-xl italic leading-snug text-ink-soft sm:text-2xl">
            &ldquo;{query}&rdquo;
          </blockquote>
        )}

        {!stage && <Understanding prefs={prefs} readFrom={readFrom} avoid={intent.avoid} onChange={setPrefs} />}

        {error && <p role="alert" className="rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}

        {stage ? (
          <DraftingProgress stage={stage} places={live} destination={stage.destination ?? prefs.destination} />
        ) : (
          <button
            type="button"
            onClick={build}
            disabled={busy}
            className="w-full rounded-full bg-brand px-5 py-4 font-semibold text-white shadow-[0_18px_40px_-20px_rgba(21,121,90,0.8)] transition enabled:hover:-translate-y-0.5 enabled:hover:bg-brand-deep enabled:active:translate-y-0 disabled:opacity-60"
          >
            {busy ? "Building your trip…" : prefs.legs && prefs.legs.length > 1 ? `Build my ${prefs.legs.length}-city trip` : "Build my trip"}
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
      {stage.label && <p className="border-b border-line bg-deep px-4 py-2.5 text-sm font-medium text-gold-bright">{stage.label}</p>}
      <ol className="grid grid-cols-3 border-b border-line">
        {steps.map((step, index) => {
          const done = index < current;
          const activeStep = index === current;
          return (
            <li key={step.id} className={`flex items-center gap-2 px-3 py-3 text-xs sm:px-4 ${activeStep ? "text-ink" : done ? "text-brand" : "text-ink-faint"}`}>
              <span
                className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold tabular-nums ${
                  done ? "bg-brand text-white" : activeStep ? "animate-pulse bg-gold-bright text-deep" : "bg-paper-sunken"
                }`}
              >
                {done ? <CheckIcon className="h-3 w-3" /> : index + 1}
              </span>
              <span className="truncate font-medium">{step.label}</span>
            </li>
          );
        })}
      </ol>

      {stage.step === "retrying" && (
        <p className="border-b border-line bg-gold/5 px-4 py-2.5 text-xs text-ink-soft">The drafter is busy — trying again in a moment…</p>
      )}

      <ul className="max-h-[28rem] divide-y divide-line overflow-y-auto">
        {places.map((place) => (
          <li key={place.id} className="flex animate-[fade-up_0.45s_ease_both] items-center gap-3 px-4 py-3">
            <PlaceArt name={place.name} category={place.category} glyphSize={48} className="h-12 w-12 shrink-0 rounded-xl" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-display text-lg leading-tight text-ink">{place.name}</span>
              <span className="block truncate text-xs text-ink-faint">
                {place.destination} · {CATEGORIES[place.category]} · {place.vibe}
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
        title={destination}
        subtitle="A couple of small changes and your trip will start taking shape."
      />

      <main className="mx-auto w-full max-w-3xl flex-1 space-y-5 px-5 py-8">
        <section className="rounded-3xl border border-gold/40 bg-gold/5 p-5 sm:p-7">
          <h2 className="text-balance font-display text-2xl leading-tight text-ink sm:text-3xl">Let&rsquo;s shape {destination} a little differently</h2>
          <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
            Try adding an interest or two, or name a nearby town or neighbourhood. The more you give us to go on, the more we can
            build around it.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={onBack} className="rounded-xl bg-ink px-5 py-3 text-sm font-medium text-paper transition hover:bg-brand-deep">
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
