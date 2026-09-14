"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { ArrowRightIcon } from "./icons";
import { PinIcon } from "./MapLink";
import { PlaceArt } from "./PlaceArt";
import { DESTINATIONS, MOODS } from "@/lib/destinations/curation";
import type { Destination } from "@/lib/destinations/types";
import { googleMapsUrl } from "@/lib/maps";

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ------------------------------------------------------------- carousel */

/** Moves the rail one card, looping back to the start at the end — and to the end from the start. */
function scrollTrack(track: HTMLElement, direction: 1 | -1) {
  const card = track.querySelector("li");
  const step = card ? card.getBoundingClientRect().width + 14 : 260;
  const max = track.scrollWidth - track.clientWidth;
  const behavior: ScrollBehavior = reducedMotion() ? "auto" : "smooth";

  if (direction === 1 && track.scrollLeft >= max - 8) track.scrollTo({ left: 0, behavior });
  else if (direction === -1 && track.scrollLeft <= 8) track.scrollTo({ left: max, behavior });
  else track.scrollBy({ left: direction * step, behavior });
}

/**
 * A rotating carousel: it drifts on its own, pauses the moment someone hovers, focuses or
 * touches it, and can be dragged with a mouse, swiped, or stepped with the arrows. Vertical
 * scrolling is never captured.
 */
export function WhereNext({ destinations }: { destinations: Destination[] }) {
  const track = useRef<HTMLUListElement>(null);
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);
  const [paused, setPaused] = useState(false);
  const [onScreen, setOnScreen] = useState(false);

  // Only drift while the rail can actually be seen: a smooth scroll animating off screen still
  // costs frames while someone is reading the story above it.
  useEffect(() => {
    const element = track.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (paused || !onScreen || reducedMotion()) return;
    const timer = window.setInterval(() => {
      if (!document.hidden && track.current) scrollTrack(track.current, 1);
    }, 3500);
    return () => window.clearInterval(timer);
  }, [paused, onScreen]);

  if (destinations.length === 0) return null;

  function onPointerDown(event: ReactPointerEvent<HTMLUListElement>) {
    if (event.pointerType !== "mouse" || event.button !== 0 || !track.current) return;
    drag.current = { x: event.clientX, left: track.current.scrollLeft, moved: false };
  }

  function onPointerMove(event: ReactPointerEvent<HTMLUListElement>) {
    const state = drag.current;
    const element = track.current;
    if (!state || !element) return;
    const dx = event.clientX - state.x;
    if (!state.moved && Math.abs(dx) > 6) {
      state.moved = true;
      element.style.scrollSnapType = "none";
      element.setPointerCapture(event.pointerId);
    }
    if (state.moved) element.scrollLeft = state.left - dx;
  }

  function endDrag() {
    if (track.current) track.current.style.scrollSnapType = "";
    // Cleared after the click that follows pointerup, so a drag never opens a card.
    window.setTimeout(() => {
      drag.current = null;
    }, 0);
  }

  return (
    <section id="destinations" className="scroll-mt-24 space-y-5" aria-roledescription="carousel" aria-label="Destinations to plan">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl leading-tight text-ink sm:text-4xl">Where to next?</h2>
          <p className="mt-1.5 text-[15px] text-ink-soft">A fresh set of places, changed every day.</p>
        </div>
        <div className="flex items-center gap-2">
          <p className="mr-1 hidden text-sm text-ink-faint sm:block">Drag, swipe or use the arrows</p>
          <ArrowButton direction={-1} onClick={() => track.current && scrollTrack(track.current, -1)} />
          <ArrowButton direction={1} onClick={() => track.current && scrollTrack(track.current, 1)} />
        </div>
      </header>

      <div
        className="edge-fade -mx-5 px-5 sm:mx-0 sm:px-0"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocusCapture={() => setPaused(true)}
        onBlurCapture={() => setPaused(false)}
        onTouchStart={() => setPaused(true)}
      >
        <ul
          ref={track}
          className="rail flex cursor-grab snap-x snap-mandatory gap-3.5 overflow-x-auto pb-3 select-none active:cursor-grabbing"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onClickCapture={(event) => {
            if (drag.current?.moved) {
              event.preventDefault();
              event.stopPropagation();
            }
          }}
          onDragStart={(event) => event.preventDefault()}
        >
          {destinations.map((destination) => (
            <li key={destination.id} className="w-52 shrink-0 snap-start sm:w-64">
              <DestinationCard destination={destination} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function ArrowButton({ direction, onClick }: { direction: 1 | -1; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={direction === 1 ? "Next destinations" : "Previous destinations"}
      className="grid h-11 w-11 place-items-center rounded-full border border-line bg-paper-raised text-ink shadow-sm transition hover:-translate-y-0.5 hover:border-brand hover:bg-brand hover:text-white active:translate-y-0"
    >
      <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d={direction === 1 ? "M9 5l7 7-7 7" : "M15 5l-7 7 7 7"} />
      </svg>
    </button>
  );
}

export function DestinationCard({ destination }: { destination: Destination }) {
  return (
    <div className="lift group relative overflow-hidden rounded-3xl bg-deep-2">
      <Link
        href={`/plan?q=${encodeURIComponent(`3 days in ${destination.name}`)}`}
        className="block"
        aria-label={`Plan a trip to ${destination.name}`}
        draggable={false}
      >
        <div className="relative aspect-[3/4]">
          {destination.thumbnailUrl ? (
            <Image
              src={destination.thumbnailUrl}
              alt=""
              fill
              draggable={false}
              loading="lazy"
              sizes="(max-width: 640px) 52vw, 256px"
              className="object-cover transition-transform duration-700 group-hover:scale-[1.06]"
            />
          ) : (
            <PlaceArt name={destination.name} className="absolute inset-0 h-full w-full" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-deep-2/95 via-deep-2/20 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-4">
            <h3 className="font-display text-2xl leading-tight text-white">{destination.name}</h3>
            {destination.countryName && <p className="text-sm text-white/75">{destination.countryName}</p>}
            <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-deep-2/55 px-3 py-1 text-xs font-semibold text-white ring-1 ring-white/25 transition group-hover:bg-gold-bright group-hover:text-deep group-hover:ring-gold-bright">
              Plan a trip <ArrowRightIcon className="h-3 w-3" />
            </span>
            {destination.thumbnailCredit && (
              <p className="mt-2 truncate text-[10px] text-white/60">Photo: {destination.thumbnailCredit}</p>
            )}
          </div>
        </div>
      </Link>

      <a
        href={googleMapsUrl(destination.name, destination.countryName)}
        target="_blank"
        rel="noopener noreferrer"
        draggable={false}
        title={`Open ${destination.name} in Google Maps`}
        aria-label={`Open ${destination.name} in Google Maps`}
        className="absolute right-3 top-3 rounded-full bg-white/90 p-2 text-deep shadow-sm transition hover:scale-110 hover:bg-gold-bright"
      >
        <PinIcon className="h-4 w-4" />
      </a>
    </div>
  );
}

/* ---------------------------------------------------------------- moods */

const MOOD_LOOK: Record<string, { gradient: string; glyph: string[]; words: [string, string] }> = {
  slow: {
    gradient: "from-[#0f5e47] via-[#1d8a64] to-[#2fbf87]",
    glyph: ["M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5Z", "M16 10.5h1.5a2.5 2.5 0 0 1 0 5H16", "M9 3.5c-.8 1.2.8 2 0 3.3", "M12.5 3.5c-.8 1.2.8 2 0 3.3"],
    words: ["Long breakfasts", "No fixed plans"],
  },
  romantic: {
    gradient: "from-[#8f3f28] via-[#c06a4a] to-[#e79a6b]",
    glyph: ["M12 20s-7.2-4.5-7.2-9.4A4 4 0 0 1 12 8.2a4 4 0 0 1 7.2 2.4C19.2 15.5 12 20 12 20Z"],
    words: ["Sunsets", "Small restaurants"],
  },
  curious: {
    gradient: "from-[#0d2f42] via-[#255c7a] to-[#3f7fa0]",
    glyph: ["M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13Z", "M15.5 15.5 20 20"],
    words: ["Odd museums", "Old neighbourhoods"],
  },
  energetic: {
    gradient: "from-[#8a5a12] via-[#b57c22] to-[#e0a63c]",
    glyph: ["M13 3 5 13.5h6L10 21l8-10.5h-6Z"],
    words: ["Long days", "Lots of ground"],
  },
  peaceful: {
    gradient: "from-[#1f5f58] via-[#3b8e82] to-[#6fc2b0]",
    glyph: ["M5 19c0-8 5-13 14-14-1 9-6 14-14 14Z", "M5 19l7-7"],
    words: ["Quiet temples", "Parks"],
  },
  cultural: {
    gradient: "from-[#34563f] via-[#5e7f55] to-[#8fb277]",
    glyph: ["M3 9l9-5 9 5", "M4 9h16", "M6.5 9v9", "M10.2 9v9", "M13.8 9v9", "M17.5 9v9", "M3 20h18"],
    words: ["Heritage", "Local food"],
  },
  adventurous: {
    gradient: "from-[#4b2f5c] via-[#7d4b78] to-[#c0719a]",
    glyph: ["M3 19l6-9 4 6 3-4 5 7Z", "M17 7.5a2 2 0 1 0 0-.01"],
    words: ["Hills", "Early starts"],
  },
  creative: {
    gradient: "from-[#2b4560] via-[#4d6f93] to-[#7fa3c7]",
    glyph: ["M4 8h3l2-2.5h6L17 8h3v11H4Z", "M12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"],
    words: ["Good light", "Street life"],
  },
};

export function MoodGrid() {
  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-display text-3xl leading-tight text-ink sm:text-4xl">What kind of trip?</h2>
          <p className="mt-1.5 text-[15px] text-ink-soft">Pick a mood — we&rsquo;ll write the first line for you.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {MOODS.map((mood) => (
          <MoodTile key={mood.id} mood={mood} />
        ))}
      </div>
    </section>
  );
}

function MoodTile({ mood }: { mood: (typeof MOODS)[number] }) {
  const ref = useRef<HTMLAnchorElement>(null);
  const look = MOOD_LOOK[mood.id] ?? MOOD_LOOK.slow;

  // Tilt and a light that follows the cursor. Written straight to the element so moving the
  // mouse never re-renders React, and skipped entirely for touch and reduced motion.
  function move(event: ReactPointerEvent<HTMLAnchorElement>) {
    const element = ref.current;
    if (!element || event.pointerType !== "mouse" || reducedMotion()) return;
    const rect = element.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    element.style.setProperty("--mx", `${x * 100}%`);
    element.style.setProperty("--my", `${y * 100}%`);
    element.style.transform = `perspective(700px) rotateX(${(0.5 - y) * 9}deg) rotateY(${(x - 0.5) * 11}deg) translateY(-4px)`;
  }

  function leave() {
    if (ref.current) ref.current.style.transform = "";
  }

  return (
    <Link
      ref={ref}
      href={`/plan?q=${encodeURIComponent(mood.prompt)}`}
      title={mood.prompt}
      onPointerMove={move}
      onPointerLeave={leave}
      className={`mood-tile group relative flex h-40 flex-col justify-between overflow-hidden rounded-3xl bg-gradient-to-br p-4 text-white shadow-[0_18px_40px_-26px_rgba(13,47,66,0.85)] transition-[transform,box-shadow] duration-200 ease-out will-change-transform hover:shadow-[0_28px_60px_-28px_rgba(13,47,66,0.9)] sm:h-48 sm:p-5 ${look.gradient}`}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: "radial-gradient(240px circle at var(--mx, 50%) var(--my, 50%), rgba(255,255,255,0.3), transparent 60%)" }}
      />
      <span aria-hidden className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10 transition-transform duration-700 group-hover:scale-[1.8]" />

      <span className="relative grid h-11 w-11 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/25 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110">
        <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
          {look.glyph.map((d) => (
            <path key={d} d={d} />
          ))}
        </svg>
      </span>

      <span className="relative">
        <span className="block font-display text-2xl leading-tight sm:text-[1.7rem]">{mood.label}</span>
        <span className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-medium text-white/90 transition duration-300 sm:translate-y-2 sm:opacity-0 sm:group-hover:translate-y-0 sm:group-hover:opacity-100 sm:group-focus-visible:translate-y-0 sm:group-focus-visible:opacity-100">
          {look.words.map((word) => (
            <span key={word} className="rounded-full bg-white/15 px-2 py-0.5">
              {word}
            </span>
          ))}
        </span>
      </span>

      <span aria-hidden className="absolute right-5 top-5 translate-x-2 opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100">
        <ArrowRightIcon className="h-5 w-5" />
      </span>
    </Link>
  );
}

/* ------------------------------------------------------------ surprise me */

/**
 * A slot machine for the undecided: city and mood reels spin, slow and land, the city's photo
 * fades in behind, and the result is one tap from a plan. Reduced motion lands instantly.
 */
export function SurpriseMe() {
  const router = useRouter();
  const pool = DESTINATIONS.filter((d) => d.thumbnailUrl);
  const [phase, setPhase] = useState<"idle" | "spinning" | "landed">("idle");
  const [pick, setPick] = useState({ city: pool[0] ?? DESTINATIONS[0], mood: MOODS[0] });
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach((timer) => window.clearTimeout(timer)), []);

  const random = <T,>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)];

  function spin() {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
    const final = { city: random(pool.length ? pool : DESTINATIONS), mood: random(MOODS) };

    if (reducedMotion()) {
      setPick(final);
      setPhase("landed");
      return;
    }

    setPhase("spinning");
    let at = 0;
    const ticks = 18;
    for (let i = 0; i < ticks; i++) {
      at += 35 + i * i * 1.1;
      const last = i === ticks - 1;
      timers.current.push(
        window.setTimeout(() => {
          setPick(last ? final : { city: random(pool.length ? pool : DESTINATIONS), mood: random(MOODS) });
          if (last) setPhase("landed");
        }, at),
      );
    }
  }

  const planHref = `/plan?q=${encodeURIComponent(`${pick.mood.prompt} in ${pick.city.name}`)}`;

  return (
    <section className="relative isolate overflow-hidden rounded-[2rem] bg-deep-2 text-white shadow-[0_40px_80px_-50px_rgba(7,28,41,0.9)]">
      {phase !== "idle" && pick.city.thumbnailUrl && (
        <Image
          key={pick.city.id}
          src={pick.city.thumbnailUrl}
          alt=""
          fill
          sizes="(max-width: 1152px) 100vw, 1152px"
          className={`animate-[fade-in_0.3s_ease_both] object-cover transition-transform duration-700 ${phase === "spinning" ? "scale-110 blur-[3px]" : "scale-100"}`}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-deep-2/95 via-deep-2/80 to-deep-2/40" />
      {/* Soft glows drawn as radial gradients: a blur filter on large shapes was one of the most
          expensive things to raster as this section scrolled into view. */}
      <span
        aria-hidden
        className="absolute -right-40 -top-48 h-[28rem] w-[28rem] rounded-full"
        style={{ background: "radial-gradient(closest-side, rgba(47,191,135,0.28), rgba(47,191,135,0))" }}
      />
      <span
        aria-hidden
        className="absolute -bottom-48 -left-10 h-[26rem] w-[26rem] rounded-full"
        style={{ background: "radial-gradient(closest-side, rgba(245,193,100,0.22), rgba(245,193,100,0))" }}
      />

      <div className="relative grid gap-7 px-6 py-10 sm:px-10 sm:py-12 md:grid-cols-[1fr_auto] md:items-center">
        <div className="min-w-0">
          <h2 className="text-balance font-display text-3xl leading-tight sm:text-5xl">
            {phase === "idle" ? (
              <>
                Can&rsquo;t decide? Let the map <span className="text-gold-bright">choose.</span>
              </>
            ) : (
              <>
                {article(pick.mood.label)} <Reel value={pick.mood.label.toLowerCase()} /> trip to <Reel value={pick.city.name} />
              </>
            )}
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/80">
            {phase === "landed" ? `${pick.mood.prompt}.` : "Spin for a city and a mood. Keep it, tweak it, or spin again."}
          </p>
          <p className="sr-only" aria-live="polite">
            {phase === "landed" ? `${article(pick.mood.label)} ${pick.mood.label.toLowerCase()} trip to ${pick.city.name}` : ""}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          {phase === "landed" && (
            <button
              type="button"
              onClick={() => router.push(planHref)}
              className="inline-flex items-center gap-2 rounded-full bg-gold-bright px-6 py-3.5 text-sm font-semibold text-deep transition hover:scale-[1.03] hover:bg-white active:scale-100"
            >
              Plan this trip <ArrowRightIcon />
            </button>
          )}
          <button
            type="button"
            onClick={spin}
            disabled={phase === "spinning"}
            className={`inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold transition enabled:hover:scale-[1.03] enabled:active:scale-100 disabled:opacity-70 ${
              phase === "landed" ? "bg-white/10 text-white ring-1 ring-white/30 hover:bg-white/20" : "bg-gold-bright text-deep hover:bg-white"
            }`}
          >
            <svg aria-hidden viewBox="0 0 24 24" className={`h-4 w-4 ${phase === "spinning" ? "animate-spin" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="4" width="16" height="16" rx="3" />
              <path d="M9 9h.01M15 9h.01M12 12h.01M9 15h.01M15 15h.01" />
            </svg>
            {phase === "idle" ? "Spin" : phase === "spinning" ? "Spinning…" : "Spin again"}
          </button>
        </div>
      </div>
    </section>
  );
}

/** "An adventurous trip", "A slow trip" — the reel once read "A adventurous". */
const article = (word: string) => (/^[aeiou]/i.test(word) ? "An" : "A");

function Reel({ value }: { value: string }) {
  return (
    <span key={value} className="reel-in inline-block rounded-xl bg-white/10 px-2 text-gold-bright ring-1 ring-white/15">
      {value}
    </span>
  );
}
