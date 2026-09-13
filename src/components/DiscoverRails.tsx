"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CATEGORIES, MOODS, RAILS, type Destination } from "@/lib/destinations";

export function DestinationRail({
  title,
  blurb,
  destinations,
}: {
  title: string;
  blurb: string;
  destinations: Destination[];
}) {
  if (destinations.length === 0) return null;

  return (
    <section className="space-y-3">
      <header className="flex items-baseline justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl text-ink sm:text-3xl">{title}</h2>
          <p className="text-sm text-ink-soft">{blurb}</p>
        </div>
      </header>

      <div className="edge-fade -mx-5 px-5 sm:mx-0 sm:px-0">
        <ul className="rail flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2">
          {destinations.map((destination) => (
            <li key={destination.id} className="w-60 shrink-0 snap-start sm:w-72">
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
    <Link
      href={`/plan?q=${encodeURIComponent(destination.name)}`}
      className="lift group block overflow-hidden rounded-2xl border border-line bg-paper-raised"
    >
      <div className="relative aspect-[4/3]">
        <Image
          src={destination.imageUrl}
          alt={destination.name}
          fill
          sizes="(max-width: 640px) 60vw, 288px"
          className="object-cover"
        />
        {destination.tier === "verified" && (
          <span className="absolute left-2 top-2 rounded-full bg-paper-raised/95 px-2.5 py-1 text-[11px] font-semibold text-moss">
            ✓ Verified set
          </span>
        )}
      </div>

      <div className="space-y-1 p-4">
        <h3 className="font-display text-xl leading-tight text-ink">{destination.name}</h3>
        <p className="line-clamp-2 text-sm leading-relaxed text-ink-soft">{destination.extract}</p>
        <p className="pt-1 text-[10px] text-ink-faint">Photo: {destination.credit}</p>
      </div>
    </Link>
  );
}

export function MoodGrid() {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-display text-2xl text-ink sm:text-3xl">What kind of trip is it?</h2>
        <p className="text-sm text-ink-soft">
          Pick a mood and we&rsquo;ll write the opening line for you. You can edit it after.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {MOODS.map((mood) => (
          <Link
            key={mood.id}
            href={`/plan?q=${encodeURIComponent(mood.prompt)}`}
            className="lift rounded-2xl border border-line bg-paper-raised p-4"
          >
            <span className="font-display text-lg leading-tight text-ink">{mood.label}</span>
            <span className="mt-1 block text-xs leading-relaxed text-ink-faint">{mood.prompt}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function CategoryStrip() {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-display text-2xl text-ink sm:text-3xl">Browse by what you care about</h2>
        <p className="text-sm text-ink-soft">
          These map to the interests behind every recommendation, not to ad categories.
        </p>
      </div>

      <div className="edge-fade -mx-5 px-5 sm:mx-0 sm:px-0">
        <ul className="rail flex gap-2.5 overflow-x-auto pb-2">
          {CATEGORIES.map((category) => (
            <li key={category.id} className="shrink-0">
              <Link
                href={`/plan?q=${encodeURIComponent(`A trip focused on ${category.label.toLowerCase()}`)}`}
                className="lift block rounded-2xl border border-line bg-paper-raised px-4 py-3"
              >
                <span className="block font-display text-lg text-ink">{category.label}</span>
                <span className="block text-xs text-ink-faint">{category.hint}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function SurpriseMe() {
  const router = useRouter();
  const pool = RAILS.flatMap((rail) => rail.destinationIds);

  function surprise() {
    const id = pool[Math.floor(Math.random() * pool.length)];
    const mood = MOODS[Math.floor(Math.random() * MOODS.length)];
    router.push(`/plan?q=${encodeURIComponent(`${mood.prompt} in ${id.replace(/-/g, " ")}`)}`);
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-line bg-paper-sunken px-5 py-8 sm:px-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-lg">
          <h2 className="font-display text-2xl leading-tight text-ink sm:text-3xl">
            No idea where you&rsquo;re going?
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
            We&rsquo;ll pick a city and a mood at random from places we actually have something
            to say about, and you can rewrite it from there.
          </p>
        </div>
        <button
          type="button"
          onClick={surprise}
          className="shrink-0 rounded-xl bg-ink px-6 py-3.5 text-sm font-medium text-paper transition hover:bg-terracotta"
        >
          Surprise me
        </button>
      </div>
    </section>
  );
}
