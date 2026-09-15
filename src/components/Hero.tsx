"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { DictationButton } from "./voice/DictationButton";
import type { CityPick } from "@/lib/moods";
import { appendSpoken } from "@/lib/voice";

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

/**
 * The trip prompt: free text, a worked example and a few places to start. It lives inside the
 * first chapter of the homepage story, so it carries no background of its own. `picks` come from
 * the server — real curated places with real photography — so the destination catalogue never
 * ships to the browser.
 */
export function HeroPrompt({ picks = [] }: { picks?: CityPick[] }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [placeholder, setPlaceholder] = useState(PLACEHOLDERS[0]);
  const areaRef = useRef<HTMLTextAreaElement>(null);

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
    <>
      {/* Stacked on a phone: side by side, the button leaves too little room to read. */}
      <div className="relative flex flex-col gap-2 rounded-3xl bg-white p-2.5 pr-14 shadow-[0_24px_60px_-28px_rgba(7,28,41,0.9)] sm:flex-row sm:items-end sm:gap-2 sm:rounded-full sm:pr-2.5">
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
        {/* Top-right corner of the stacked card on a phone; inline beside the button from sm up. */}
        <span className="absolute right-3 top-3 sm:static sm:mb-0.5">
          <DictationButton
            label="Describe your trip by voice"
            onText={(spoken) => {
              setText((current) => appendSpoken(current, spoken));
              requestAnimationFrame(() => {
                if (areaRef.current) grow(areaRef.current);
              });
            }}
          />
        </span>
        {/* Never disabled: an empty click focuses the field rather than reading as broken. */}
        <button
          type="button"
          onClick={() => (text.trim() ? go(text) : areaRef.current?.focus())}
          className="w-full shrink-0 rounded-full bg-brand px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-deep active:scale-[0.98] sm:w-auto sm:px-6"
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
        <span className="text-xs text-white/55">Enter to go · or tap the mic and just say it</span>
      </div>

      <div className="mt-7">
        <p className="mb-2.5 text-xs font-medium text-white/70">Start somewhere</p>
        <ul className="flex flex-wrap gap-2">
          {picks.map((destination) => (
            <li key={destination.id}>
              <button
                type="button"
                onClick={() => go(destination.name)}
                className="flex items-center gap-2 rounded-full bg-deep-2/55 py-1.5 pl-1.5 pr-4 text-sm text-white ring-1 ring-white/20 transition hover:bg-deep-2/75"
              >
                {destination.thumbnailUrl && (
                  <span className="relative h-7 w-7 overflow-hidden rounded-full">
                    <Image src={destination.thumbnailUrl} alt="" fill sizes="28px" className="object-cover" />
                  </span>
                )}
                {destination.name}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </>
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
