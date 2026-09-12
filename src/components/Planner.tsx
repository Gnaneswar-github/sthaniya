"use client";

import { useCallback, useState } from "react";
import { formatTime, StopCard } from "./StopCard";
import {
  DIAL_POSITIONS,
  INTERESTS,
  LOCALITY_TAGS,
  TIME_BUCKETS,
  type DialPosition,
  type Interest,
  type Itinerary,
  type TimeBucket,
} from "@/lib/types";

const CITY_SUGGESTIONS = ["Pune", "Kumbakonam", "Mumbai"];
const MAX_INTERESTS = 3;
const STEPS = ["Where", "How long", "What you're into", "How local"];

function shareText(itinerary: Itinerary): string {
  const bucket = TIME_BUCKETS.find((b) => b.id === itinerary.timeBucket);
  const dial = DIAL_POSITIONS.find((d) => d.id === itinerary.dial);
  const lines = [`${itinerary.destination} — ${bucket?.label.toLowerCase()}, the ${dial?.label.toLowerCase()} way`, ""];

  let day = 0;
  for (const stop of itinerary.stops) {
    if (stop.day !== day) {
      day = stop.day;
      if (itinerary.stops.some((s) => s.day > 1)) lines.push(`— Day ${day} —`);
    }
    lines.push(`${formatTime(stop.timeWindow.start)}  ${stop.name} (${LOCALITY_TAGS[stop.tag]})`);
    lines.push(`   ${stop.description}`);
    lines.push("");
  }

  lines.push("Planned with Sthānīya");
  return lines.join("\n");
}

export function Planner() {
  const [step, setStep] = useState(0);
  const [destination, setDestination] = useState("");
  const [timeBucket, setTimeBucket] = useState<TimeBucket | null>(null);
  const [interests, setInterests] = useState<Interest[]>([]);
  const [dial, setDial] = useState<DialPosition>("local");
  const [itinerary, setItinerary] = useState<Itinerary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shared, setShared] = useState(false);

  const generate = useCallback(
    async (position: DialPosition) => {
      if (!timeBucket) return;
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/itinerary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ destination, timeBucket, interests, dial: position }),
        });
        if (!response.ok) throw new Error("Request failed");
        setItinerary(await response.json());
      } catch {
        setError("Something went wrong putting the plan together. Try again?");
      } finally {
        setLoading(false);
      }
    },
    [destination, timeBucket, interests],
  );

  function toggleInterest(id: Interest) {
    setInterests((current) =>
      current.includes(id)
        ? current.filter((i) => i !== id)
        : current.length < MAX_INTERESTS
          ? [...current, id]
          : current,
    );
  }

  async function share() {
    if (!itinerary) return;
    const text = shareText(itinerary);
    if (navigator.share) {
      try {
        await navigator.share({ title: `${itinerary.destination} — Sthānīya`, text });
        return;
      } catch {
        // Cancelled or unsupported — fall through to copying.
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      setShared(true);
      setTimeout(() => setShared(false), 2500);
    } catch {
      setError("Couldn't copy automatically — select the plan text and copy it.");
    }
  }

  function restart() {
    setItinerary(null);
    setStep(0);
    setDestination("");
    setTimeBucket(null);
    setInterests([]);
    setDial("local");
  }

  if (itinerary) {
    return (
      <Results
        itinerary={itinerary}
        dial={dial}
        loading={loading}
        shared={shared}
        error={error}
        onDial={(position) => {
          setDial(position);
          void generate(position);
        }}
        onShare={share}
        onRestart={restart}
      />
    );
  }

  return (
    <div className="rise space-y-8">
      <ol className="flex gap-2" aria-label="Progress">
        {STEPS.map((label, index) => (
          <li
            key={label}
            className={`h-1 flex-1 rounded-full ${index <= step ? "bg-terracotta" : "bg-line"}`}
          >
            <span className="sr-only">{label}</span>
          </li>
        ))}
      </ol>

      {step === 0 && (
        <Step title="Where are you going?" hint="One city, however long you've got.">
          <input
            autoFocus
            value={destination}
            onChange={(event) => setDestination(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && destination.trim()) setStep(1);
            }}
            placeholder="Pune"
            className="w-full rounded-xl border border-line bg-paper-raised px-4 py-4 font-display text-2xl text-ink outline-none placeholder:text-ink-faint/60 focus:border-terracotta"
          />
          <div className="flex flex-wrap gap-2">
            {CITY_SUGGESTIONS.map((city) => (
              <button
                key={city}
                type="button"
                onClick={() => {
                  setDestination(city);
                  setStep(1);
                }}
                className="rounded-full border border-line bg-paper-raised px-4 py-2 text-sm text-ink-soft transition hover:border-terracotta hover:text-terracotta"
              >
                {city}
              </button>
            ))}
          </div>
          <Primary disabled={!destination.trim()} onClick={() => setStep(1)}>
            Next
          </Primary>
        </Step>
      )}

      {step === 1 && (
        <Step title="How long do you have?" hint="Be honest — a rushed plan helps nobody." onBack={() => setStep(0)}>
          <div className="grid gap-3">
            {TIME_BUCKETS.map((bucket) => (
              <button
                key={bucket.id}
                type="button"
                onClick={() => {
                  setTimeBucket(bucket.id);
                  setStep(2);
                }}
                className={`rounded-xl border px-5 py-4 text-left font-display text-xl transition ${
                  timeBucket === bucket.id
                    ? "border-terracotta bg-terracotta/5 text-terracotta"
                    : "border-line bg-paper-raised text-ink hover:border-terracotta"
                }`}
              >
                {bucket.label}
              </button>
            ))}
          </div>
        </Step>
      )}

      {step === 2 && (
        <Step
          title="What are you actually into?"
          hint={`Pick up to ${MAX_INTERESTS}. We'll build the day around them.`}
          onBack={() => setStep(1)}
        >
          <div className="flex flex-wrap gap-2">
            {INTERESTS.map((interest) => {
              const active = interests.includes(interest.id);
              const full = interests.length >= MAX_INTERESTS && !active;
              return (
                <button
                  key={interest.id}
                  type="button"
                  disabled={full}
                  onClick={() => toggleInterest(interest.id)}
                  className={`rounded-full border px-5 py-3 text-[15px] transition ${
                    active
                      ? "border-terracotta bg-terracotta text-paper-raised"
                      : full
                        ? "border-line bg-paper-raised text-ink-faint/50"
                        : "border-line bg-paper-raised text-ink hover:border-terracotta"
                  }`}
                >
                  {interest.label}
                </button>
              );
            })}
          </div>
          <Primary disabled={interests.length === 0} onClick={() => setStep(3)}>
            Next
          </Primary>
        </Step>
      )}

      {step === 3 && (
        <Step
          title="How local do you want to go?"
          hint="This genuinely changes what you get — not just the wording."
          onBack={() => setStep(2)}
        >
          <Dial value={dial} onChange={setDial} />
          <Primary loading={loading} onClick={() => void generate(dial)}>
            {loading ? "Putting it together…" : "Show me the plan"}
          </Primary>
          {error && <p className="text-sm text-terracotta">{error}</p>}
        </Step>
      )}
    </div>
  );
}

function Step({
  title,
  hint,
  onBack,
  children,
}: {
  title: string;
  hint: string;
  onBack?: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="rise space-y-5">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-ink-faint transition hover:text-terracotta"
        >
          ← Back
        </button>
      )}
      <div>
        <h2 className="font-display text-3xl leading-tight text-ink">{title}</h2>
        <p className="mt-2 text-[15px] text-ink-soft">{hint}</p>
      </div>
      {children}
    </section>
  );
}

function Dial({ value, onChange }: { value: DialPosition; onChange: (value: DialPosition) => void }) {
  const index = DIAL_POSITIONS.findIndex((d) => d.id === value);
  const active = DIAL_POSITIONS[index];

  return (
    <div className="space-y-4 rounded-2xl border border-line bg-paper-raised p-5">
      <input
        type="range"
        min={0}
        max={DIAL_POSITIONS.length - 1}
        step={1}
        value={index}
        onChange={(event) => onChange(DIAL_POSITIONS[Number(event.target.value)].id)}
        aria-label="Locality dial"
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-line accent-terracotta"
      />
      <div className="flex justify-between text-xs font-medium">
        {DIAL_POSITIONS.map((position) => (
          <button
            key={position.id}
            type="button"
            onClick={() => onChange(position.id)}
            className={`transition ${position.id === value ? "text-terracotta" : "text-ink-faint"}`}
          >
            {position.label}
          </button>
        ))}
      </div>
      <p className="font-display text-lg leading-snug text-ink">{active.blurb}</p>
    </div>
  );
}

function Results({
  itinerary,
  dial,
  loading,
  shared,
  error,
  onDial,
  onShare,
  onRestart,
}: {
  itinerary: Itinerary;
  dial: DialPosition;
  loading: boolean;
  shared: boolean;
  error: string | null;
  onDial: (value: DialPosition) => void;
  onShare: () => void;
  onRestart: () => void;
}) {
  const bucket = TIME_BUCKETS.find((b) => b.id === itinerary.timeBucket);
  const chosen = itinerary.interests
    .map((i) => INTERESTS.find((known) => known.id === i)?.label)
    .filter(Boolean)
    .join(" · ");
  const days = [...new Set(itinerary.stops.map((s) => s.day))];

  return (
    <div className="space-y-6">
      <div className="rise space-y-2">
        <button
          type="button"
          onClick={onRestart}
          className="text-sm text-ink-faint transition hover:text-terracotta"
        >
          ← Start over
        </button>
        <h2 className="font-display text-4xl leading-tight text-ink">{itinerary.destination}</h2>
        <p className="text-[15px] text-ink-soft">
          {bucket?.label} · {chosen}
        </p>
      </div>

      <div className="rounded-2xl border border-line bg-paper-raised p-5">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-faint">
          Move the dial — the plan changes with it
        </p>
        <Dial value={dial} onChange={onDial} />
      </div>

      {itinerary.notes.map((note) => (
        <p
          key={note}
          className="rounded-xl border border-saffron/30 bg-saffron/5 px-4 py-3 text-[15px] leading-relaxed text-ink-soft"
        >
          {note}
        </p>
      ))}

      {error && <p className="text-sm text-terracotta">{error}</p>}

      <div className={`space-y-6 transition-opacity ${loading ? "opacity-40" : ""}`}>
        {days.map((day) => (
          <section key={day} className="space-y-4">
            {days.length > 1 && (
              <h3 className="font-display text-xl text-ink-soft">Day {day}</h3>
            )}
            {itinerary.stops
              .filter((stop) => stop.day === day)
              .map((stop) => (
                <StopCard key={stop.id} stop={stop} />
              ))}
          </section>
        ))}
      </div>

      {itinerary.stops.length > 0 && (
        <button
          type="button"
          onClick={onShare}
          className="w-full rounded-xl bg-ink px-5 py-4 font-medium text-paper transition hover:bg-terracotta"
        >
          {shared ? "Copied — paste it anywhere" : "Share this plan"}
        </button>
      )}
    </div>
  );
}

function Primary({
  children,
  onClick,
  disabled,
  loading,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className="w-full rounded-xl bg-ink px-5 py-4 font-medium text-paper transition enabled:hover:bg-terracotta disabled:opacity-30"
    >
      {children}
    </button>
  );
}
