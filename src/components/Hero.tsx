"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { WaveDivider } from "./PageHero";
import { DESTINATIONS } from "@/lib/destinations/curation";
import { PHASES } from "@/lib/phases";

/** Short enough to sit on one line in the pill — a clipped placeholder reads as a bug. */
const PLACEHOLDERS = [
  "3 days in Tokyo with my wife…",
  "A long weekend in Lisbon, solo…",
  "One evening in Kyoto…",
  "6 hours in Colombo before my flight…",
];

/** What the example button fills in: the full shape of a brief we can actually read. */
const EXAMPLE =
  "3 days in Tokyo with my wife. We love local food, quiet temples and photography. We don't like crowded tourist attractions. Budget around $200 per day.";

/** Real curated places with real photography — never a list of cities we can't back up. */
const QUICK_PICKS = [
  "curated:tokyo",
  "curated:kyoto",
  "curated:lisbon",
  "curated:istanbul",
  "curated:marrakesh",
];

export function Hero() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [placeholder, setPlaceholder] = useState(PLACEHOLDERS[0]);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  const picks = QUICK_PICKS.map((id) => DESTINATIONS.find((d) => d.id === id)).filter(
    (d): d is NonNullable<typeof d> => Boolean(d),
  );

  // Rotating example, so the field reads as an invitation rather than a template.
  useEffect(() => {
    const timer = setInterval(() => {
      setPlaceholder(
        (current) => PLACEHOLDERS[(PLACEHOLDERS.indexOf(current) + 1) % PLACEHOLDERS.length],
      );
    }, 6500);
    return () => clearInterval(timer);
  }, []);

  function grow(element: HTMLTextAreaElement) {
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, 160)}px`;
  }

  // An empty field still has to fit its placeholder, which changes length as it rotates and
  // wraps differently on a phone. Measuring beats guessing at copy that fits.
  useEffect(() => {
    if (areaRef.current && !text) grow(areaRef.current);
  }, [placeholder, text]);

  function go(value: string) {
    if (!value.trim()) return;
    router.push(`/plan?q=${encodeURIComponent(value.trim())}`);
  }

  return (
    <section className="relative isolate overflow-hidden bg-deep-2">
      <Image
        src={PHASES.sunset.image}
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover object-[60%_center]"
      />
      {/* Two passes: one to carry the text, one to seat the photo behind it. */}
      <div aria-hidden className={`absolute inset-0 ${PHASES.sunset.wash}`} />
      <div aria-hidden className={`absolute inset-0 ${PHASES.sunset.veil}`} />

      <div className="relative mx-auto w-full max-w-6xl px-5 pb-28 pt-14 sm:pb-36 sm:pt-20">
        <p className="rise text-[11px] font-semibold uppercase tracking-[0.28em] text-white/70">
          Your next journey
        </p>

        <h1 className="rise rise-1 mt-4 max-w-3xl font-display text-[2.6rem] font-semibold leading-[1.03] text-white sm:text-7xl">
          Travel like you
          <br />
          <span className="text-gold-bright">actually live there.</span>
        </h1>

        <p className="rise rise-2 mt-5 max-w-xl text-[15px] leading-relaxed text-white/80 sm:text-lg">
          Describe the trip the way you&rsquo;d describe it to a friend. We read it, show you
          exactly what we understood, and build something you can argue with.
        </p>

        <div className="rise rise-3 mt-8 max-w-2xl">
          {/* Stacked on a phone: side by side, the button leaves too little room to read. */}
          <div className="flex flex-col gap-2 rounded-3xl bg-white p-2.5 shadow-[0_24px_60px_-28px_rgba(7,28,41,0.9)] sm:flex-row sm:items-end sm:gap-2 sm:rounded-full">
            <span aria-hidden className="hidden shrink-0 pb-2.5 pl-3 text-brand sm:block">
              <PinIcon />
            </span>
            <textarea
              ref={areaRef}
              rows={1}
              value={text}
              aria-label="Describe your trip"
              placeholder={placeholder}
              onChange={(event) => {
                setText(event.target.value);
                grow(event.target);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  go(text);
                }
              }}
              className="max-h-40 min-h-[44px] flex-1 resize-none bg-transparent px-3 py-2.5 text-[15px] leading-relaxed text-ink outline-none placeholder:text-ink-faint/80 sm:text-base"
            />
            {/* Never disabled: an empty click focuses the field rather than reading as broken. */}
            <button
              type="button"
              onClick={() => (text.trim() ? go(text) : areaRef.current?.focus())}
              className="w-full shrink-0 rounded-full bg-brand px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-bright sm:w-auto sm:px-6"
            >
              Build my journey
            </button>
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 pl-2">
            <button
              type="button"
              onClick={() => {
                setText(EXAMPLE);
                requestAnimationFrame(() => {
                  if (areaRef.current) {
                    grow(areaRef.current);
                    areaRef.current.focus();
                  }
                });
              }}
              className="text-xs font-medium text-gold-bright underline-offset-4 hover:underline"
            >
              Try a full example
            </button>
            <span className="text-xs text-white/50">
              Enter to go · Shift + Enter for a new line
            </span>
          </div>
        </div>

        <div className="rise rise-4 mt-7">
          <p className="mb-2.5 text-xs font-medium text-white/65">Start somewhere</p>
          <ul className="flex flex-wrap gap-2">
            {picks.map((destination) => (
              <li key={destination.id}>
                <button
                  type="button"
                  onClick={() => go(destination.name)}
                  className="flex items-center gap-2 rounded-full bg-white/12 py-1.5 pl-1.5 pr-4 text-sm text-white ring-1 ring-white/20 backdrop-blur transition hover:bg-white/20"
                >
                  {destination.thumbnailUrl && (
                    <span className="relative h-7 w-7 overflow-hidden rounded-full">
                      <Image
                        src={destination.thumbnailUrl}
                        alt=""
                        fill
                        sizes="28px"
                        className="object-cover"
                      />
                    </span>
                  )}
                  {destination.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <WaveDivider />

      <p className="pointer-events-none absolute bottom-[62px] right-3 z-10 text-[10px] text-white/45 sm:bottom-[92px]">
        {PHASES.sunset.credit}
      </p>
    </section>
  );
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" strokeLinejoin="round" />
      <circle cx="12" cy="10" r="2.6" />
    </svg>
  );
}
