"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PinIcon } from "./MapLink";
import { PlaceArt } from "./PlaceArt";
import { DESTINATIONS, MOODS } from "@/lib/destinations/curation";
import type { Destination } from "@/lib/destinations/types";
import { googleMapsUrl } from "@/lib/maps";

export function WhereNext({ destinations }: { destinations: Destination[] }) {
  if (destinations.length === 0) return null;

  return (
    <section id="destinations" className="scroll-mt-24 space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-brand">Fresh picks today</p>
          <h2 className="mt-1.5 font-display text-3xl leading-tight text-ink sm:text-4xl">Where to next?</h2>
        </div>
        <p className="text-sm text-ink-faint">Tap a city to start planning.</p>
      </header>

      <div className="edge-fade -mx-5 px-5 sm:mx-0 sm:px-0">
        <ul className="rail flex snap-x snap-mandatory gap-3.5 overflow-x-auto pb-3">
          {destinations.map((destination) => (
            <li key={destination.id} className="w-52 shrink-0 snap-start sm:w-60">
              <DestinationCard destination={destination} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function DestinationCard({ destination }: { destination: Destination }) {
  return (
    <div className="lift group relative overflow-hidden rounded-3xl bg-deep-2">
      <Link
        href={`/plan?q=${encodeURIComponent(`3 days in ${destination.name}`)}`}
        className="block"
        aria-label={`Plan a trip to ${destination.name}`}
      >
        <div className="relative aspect-[3/4]">
          {destination.thumbnailUrl ? (
            <Image
              src={destination.thumbnailUrl}
              alt=""
              fill
              loading="lazy"
              sizes="(max-width: 640px) 52vw, 240px"
              className="object-cover transition-transform duration-700 group-hover:scale-[1.05]"
            />
          ) : (
            <PlaceArt name={destination.name} className="absolute inset-0 h-full w-full" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-deep-2/90 via-deep-2/15 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-4">
            <h3 className="font-display text-2xl leading-tight text-white">{destination.name}</h3>
            {destination.countryName && <p className="text-sm text-white/75">{destination.countryName}</p>}
            <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white ring-1 ring-white/25 backdrop-blur transition group-hover:bg-gold-bright group-hover:text-deep group-hover:ring-gold-bright">
              Plan a trip <span aria-hidden>→</span>
            </span>
          </div>
        </div>
      </Link>

      <a
        href={googleMapsUrl(destination.name, destination.countryName)}
        target="_blank"
        rel="noopener noreferrer"
        title={`Open ${destination.name} in Google Maps`}
        aria-label={`Open ${destination.name} in Google Maps`}
        className="absolute right-3 top-3 rounded-full bg-white/90 p-2 text-deep shadow-sm transition hover:scale-110 hover:bg-gold-bright"
      >
        <PinIcon className="h-4 w-4" />
      </a>

      {destination.thumbnailCredit && (
        <p className="pointer-events-none absolute left-3 top-3.5 max-w-[65%] truncate text-[9px] text-white/70 [text-shadow:0_1px_4px_rgba(0,0,0,0.6)]">
          Photo: {destination.thumbnailCredit}
        </p>
      )}
    </div>
  );
}

const MOOD_STYLES = [
  "from-[#0f5e47] to-[#2fbf87]",
  "from-[#8f3f28] to-[#e79a6b]",
  "from-[#0d2f42] to-[#3f7fa0]",
  "from-[#8a5a12] to-[#e0a63c]",
  "from-[#1f5f58] to-[#5fb3a1]",
  "from-[#34563f] to-[#8fb277]",
  "from-[#4b2f5c] to-[#b0668c]",
  "from-[#2b4560] to-[#6f93b7]",
];

export function MoodGrid() {
  return (
    <section className="space-y-5">
      <div>
        <h2 className="font-display text-3xl leading-tight text-ink sm:text-4xl">What kind of trip?</h2>
        <p className="mt-1 text-sm text-ink-soft">Pick a mood and we&rsquo;ll write the first line for you.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {MOODS.map((mood, index) => (
          <Link
            key={mood.id}
            href={`/plan?q=${encodeURIComponent(mood.prompt)}`}
            title={mood.prompt}
            className={`lift group relative flex h-24 items-end overflow-hidden rounded-2xl bg-gradient-to-br p-4 text-white sm:h-28 ${MOOD_STYLES[index % MOOD_STYLES.length]}`}
          >
            <span className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-white/10 transition-transform duration-500 group-hover:scale-150" />
            <span className="relative font-display text-xl leading-tight sm:text-2xl">{mood.label}</span>
            <span
              aria-hidden
              className="absolute right-4 top-4 translate-x-1 opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100"
            >
              →
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function SurpriseMe() {
  const router = useRouter();

  function surprise() {
    const destination = DESTINATIONS[Math.floor(Math.random() * DESTINATIONS.length)];
    const mood = MOODS[Math.floor(Math.random() * MOODS.length)];
    router.push(`/plan?q=${encodeURIComponent(`${mood.prompt} in ${destination.name}`)}`);
  }

  return (
    <section className="relative overflow-hidden rounded-3xl bg-deep px-6 py-9 sm:px-10">
      <span aria-hidden className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-brand-bright/20 blur-2xl" />
      <span aria-hidden className="absolute -bottom-20 left-10 h-48 w-48 rounded-full bg-gold-bright/15 blur-2xl" />
      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-lg">
          <h2 className="font-display text-3xl leading-tight text-white">Can&rsquo;t decide?</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-white/75">
            We&rsquo;ll pick a city and a mood. Change anything you like after.
          </p>
        </div>
        <button
          type="button"
          onClick={surprise}
          className="shrink-0 rounded-full bg-gold-bright px-7 py-3.5 text-sm font-semibold text-deep transition hover:scale-[1.03] hover:bg-white"
        >
          Surprise me
        </button>
      </div>
    </section>
  );
}
