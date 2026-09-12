"use client";

import { useState } from "react";
import {
  DIAL_POSITIONS,
  INTERESTS,
  PACES,
  SUPPORTED_CITIES,
  TRAVELLER_TYPES,
  type DialPosition,
  type Interest,
  type Pace,
  type TravellerType,
  type TripPrefs,
} from "@/lib/types";

function isoToday(offsetDays = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

export function TripSetup({ onCreate, busy }: { onCreate: (prefs: TripPrefs) => void; busy: boolean }) {
  const [destination, setDestination] = useState("");
  const [startDate, setStartDate] = useState(isoToday(1));
  const [endDate, setEndDate] = useState(isoToday(3));
  const [travellerType, setTravellerType] = useState<TravellerType>("solo");
  const [interests, setInterests] = useState<Interest[]>([]);
  const [dial, setDial] = useState<DialPosition>("local");
  const [pace, setPace] = useState<Pace>("balanced");
  const [budget, setBudget] = useState(3000);
  const [notes, setNotes] = useState("");

  const nights = Math.max(
    0,
    Math.round((Date.parse(endDate) - Date.parse(startDate)) / 86_400_000),
  );
  const ready = destination.trim() !== "" && interests.length > 0 && nights >= 0;

  function toggle(id: Interest) {
    setInterests((current) =>
      current.includes(id) ? current.filter((i) => i !== id) : [...current, id],
    );
  }

  return (
    <div className="rise space-y-9">
      <div className="space-y-3">
        <h2 className="font-display text-4xl leading-[1.1] text-ink">
          Travel like you actually live there.
        </h2>
        <p className="text-[15px] leading-relaxed text-ink-soft">
          Tell Sthānīya where you&rsquo;re going, what you love and how you want to spend your
          time. You&rsquo;ll get a trip you can rearrange, trim and argue with — not a list.
        </p>
      </div>

      <Field label="Where are you going?">
        <input
          value={destination}
          onChange={(event) => setDestination(event.target.value)}
          placeholder="Pune"
          className="w-full rounded-xl border border-line bg-paper-raised px-4 py-4 font-display text-2xl text-ink outline-none placeholder:text-ink-faint/50 focus:border-terracotta"
        />
        <div className="mt-2 flex flex-wrap gap-2">
          {SUPPORTED_CITIES.map((city) => (
            <button
              key={city}
              type="button"
              onClick={() => setDestination(city)}
              className="rounded-full border border-line bg-paper-raised px-4 py-2 text-sm text-ink-soft transition hover:border-terracotta hover:text-terracotta"
            >
              {city}
            </button>
          ))}
        </div>
      </Field>

      <Field label="When?" hint={nights > 0 ? `${nights} ${nights === 1 ? "night" : "nights"}` : undefined}>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            className="flex-1 rounded-xl border border-line bg-paper-raised px-4 py-3 text-ink outline-none focus:border-terracotta"
          />
          <span className="text-ink-faint">→</span>
          <input
            type="date"
            value={endDate}
            min={startDate}
            onChange={(event) => setEndDate(event.target.value)}
            className="flex-1 rounded-xl border border-line bg-paper-raised px-4 py-3 text-ink outline-none focus:border-terracotta"
          />
        </div>
      </Field>

      <Field label="Who's going?">
        <Options
          items={TRAVELLER_TYPES}
          selected={travellerType}
          onSelect={(id) => setTravellerType(id as TravellerType)}
        />
      </Field>

      <Field label="What do you want from this trip?" hint="Pick as many as you like">
        <div className="flex flex-wrap gap-2">
          {INTERESTS.map((interest) => {
            const active = interests.includes(interest.id);
            return (
              <button
                key={interest.id}
                type="button"
                onClick={() => toggle(interest.id)}
                className={`rounded-full border px-4 py-2.5 text-[15px] transition ${
                  active
                    ? "border-terracotta bg-terracotta text-paper-raised"
                    : "border-line bg-paper-raised text-ink hover:border-terracotta"
                }`}
              >
                {interest.label}
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="How local do you want to go?" hint="This changes which places are eligible at all">
        <div className="space-y-3 rounded-2xl border border-line bg-paper-raised p-5">
          <input
            type="range"
            min={0}
            max={2}
            step={1}
            value={DIAL_POSITIONS.findIndex((d) => d.id === dial)}
            onChange={(event) => setDial(DIAL_POSITIONS[Number(event.target.value)].id)}
            aria-label="Locality dial"
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-line accent-terracotta"
          />
          <div className="flex justify-between text-xs font-medium">
            {DIAL_POSITIONS.map((position) => (
              <button
                key={position.id}
                type="button"
                onClick={() => setDial(position.id)}
                className={position.id === dial ? "text-terracotta" : "text-ink-faint"}
              >
                {position.label}
              </button>
            ))}
          </div>
          <p className="font-display text-lg leading-snug text-ink">
            {DIAL_POSITIONS.find((d) => d.id === dial)?.blurb}
          </p>
        </div>
      </Field>

      <Field label="What pace suits you?">
        <div className="grid gap-2">
          {PACES.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setPace(option.id)}
              className={`rounded-xl border px-5 py-3.5 text-left transition ${
                pace === option.id
                  ? "border-terracotta bg-terracotta/5"
                  : "border-line bg-paper-raised hover:border-terracotta"
              }`}
            >
              <span className="font-display text-lg text-ink">{option.label}</span>
              <span className="block text-sm text-ink-soft">{option.blurb}</span>
            </button>
          ))}
        </div>
      </Field>

      <Field label="Budget per day" hint={`About ₹${budget.toLocaleString("en-IN")} per person`}>
        <input
          type="range"
          min={500}
          max={10000}
          step={500}
          value={budget}
          onChange={(event) => setBudget(Number(event.target.value))}
          className="h-2 w-full cursor-pointer appearance-none rounded-full bg-line accent-terracotta"
        />
        <div className="mt-1 flex justify-between text-xs text-ink-faint">
          <span>₹500</span>
          <span>₹10,000</span>
        </div>
      </Field>

      <Field label="Anything else we should know?" hint="Optional, but it's the most useful box here">
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={4}
          placeholder="I'm vegetarian, I don't like crowds, and I'd rather walk than take a cab."
          className="w-full resize-none rounded-xl border border-line bg-paper-raised px-4 py-3 text-[15px] leading-relaxed text-ink outline-none placeholder:text-ink-faint/50 focus:border-terracotta"
        />
      </Field>

      <button
        type="button"
        disabled={!ready || busy}
        onClick={() =>
          onCreate({
            destination: destination.trim(),
            startDate,
            endDate,
            travellerType,
            interests,
            dial,
            pace,
            budgetPerDayInr: budget,
            notes: notes.trim(),
          })
        }
        className="w-full rounded-xl bg-ink px-5 py-4 font-medium text-paper transition enabled:hover:bg-terracotta disabled:opacity-30"
      >
        {busy ? "Building your trip…" : "Create my trip"}
      </button>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-display text-xl text-ink">{label}</h3>
        {hint && <span className="text-xs text-ink-faint">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

function Options({
  items,
  selected,
  onSelect,
}: {
  items: readonly { id: string; label: string }[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onSelect(item.id)}
          className={`rounded-full border px-4 py-2.5 text-[15px] transition ${
            selected === item.id
              ? "border-terracotta bg-terracotta text-paper-raised"
              : "border-line bg-paper-raised text-ink hover:border-terracotta"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
