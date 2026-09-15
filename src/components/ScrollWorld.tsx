import Image from "next/image";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { HeroPrompt } from "./Hero";
import { WaveDivider } from "./PageHero";
import { CHAPTERS, type Chapter } from "./scroll-world/chapters";
import { StoryController } from "./scroll-world/StoryController";
import { cityPicks } from "@/lib/destinations/curation";
import { PHASES, type Phase } from "@/lib/phases";

/** "Start somewhere" under the trip prompt: curated places with real photography. */
const QUICK_PICKS = ["curated:tokyo", "curated:kyoto", "curated:lisbon", "curated:istanbul", "curated:marrakesh"];

/**
 * The live Three.js island is opt-in. Measured on a laptop with integrated graphics it still
 * competed with scrolling and typing for the GPU — a 736 ms stalled keystroke at start-up — so
 * the default story is told with a photograph and tints that crossfade on the compositor, which
 * never blocks input. Set NEXT_PUBLIC_HERO_3D=1 to bring the island back on capable hardware.
 */
const WORLD_ENABLED = process.env.NEXT_PUBLIC_HERO_3D === "1";

/** The time of day for each chapter, following the story from sunset through night to dawn. */
const CHAPTER_PHASE: Phase[] = ["sunset", "golden", "dusk", "dusk", "dawn"];
const PHOTO_LAYERS = [...new Set(CHAPTER_PHASE)];

/** A tint per time of day, laid over the one photograph. */
const TINT: Record<Phase, string> = {
  sunset: PHASES.sunset.wash,
  golden: "bg-gradient-to-r from-[#3a2410]/90 via-[#6b4318]/65 to-[#c98f3c]/35",
  dusk: "bg-gradient-to-r from-[#0b0f24]/95 via-[#1b2552]/85 to-[#3a2f5c]/60",
  dawn: "bg-gradient-to-r from-[#0b2b36]/90 via-[#1d6473]/60 to-[#f4bd8e]/35",
};

/**
 * The homepage story, rendered on the server. Native scroll is the only input: StoryController
 * marks the active chapter, its tint and the rail by attribute, so the story costs almost nothing
 * to hydrate and scrolling never re-renders React. Every word, link and the trip prompt are real
 * DOM; the imagery behind them is decoration.
 */
export function ScrollWorld({ nav }: { nav: ReactNode }) {
  return (
    <div data-story className="relative isolate bg-deep-2">
      {nav}

      {/* One persistent layer for the whole story. Sticky, not fixed, so nothing intercepts the
          wheel — and bounded by an absolute track the exact height of the story. */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="sticky top-0 h-[100svh] overflow-hidden">
          {/* One photograph for the whole story; each chapter's time of day is a light tint over it.
              Four full-screen photos meant four large decodes and GPU uploads — measured as a
              stalled keystroke — while a tint is a gradient the compositor fades for free. */}
          <Image src={PHASES.sunset.image} alt="" fill priority sizes="100vw" className="object-cover object-[60%_center]" />
          {PHOTO_LAYERS.map((phase) => (
            <div
              key={phase}
              data-tint={phase}
              data-on={phase === CHAPTER_PHASE[0]}
              className={`sw-tint absolute inset-0 opacity-0 transition-opacity duration-1000 ease-out data-[on=true]:opacity-100 ${TINT[phase]}`}
            />
          ))}
          {WORLD_ENABLED && (
            <div data-world-stage data-on={false} className="absolute inset-0 opacity-0 transition-opacity duration-700 ease-out data-[on=true]:opacity-100" />
          )}
          {/* Authored scrims keep copy legible over every time of day. */}
          <div className="absolute inset-0 bg-gradient-to-t from-deep-2/85 via-deep-2/25 to-deep-2/35 sm:bg-gradient-to-r sm:from-deep-2/80 sm:via-deep-2/30 sm:to-transparent" />
          <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-deep-2/60 to-transparent" />
        </div>
      </div>

      {CHAPTERS.map((chapter, index) => (
        <section
          key={chapter.id}
          id={`story-${chapter.id}`}
          data-chapter={index}
          data-phase={CHAPTER_PHASE[Math.min(index, CHAPTER_PHASE.length - 1)]}
          data-active={index === 0}
          aria-labelledby={`story-${chapter.id}-title`}
          className="sw-chapter relative z-10 flex items-center"
          style={{ minHeight: `${chapter.weight * 100}svh` }}
        >
          <div className="mx-auto w-full max-w-6xl px-5 pb-28 pt-24 sm:pb-32 sm:pt-28">
            {index === 0 ? <Intro chapter={chapter} /> : <Beat chapter={chapter} last={index === CHAPTERS.length - 1} />}
          </div>
        </section>
      ))}

      <nav
        data-rail
        data-on
        aria-label="Story chapters"
        className="fixed right-4 top-1/2 z-20 hidden -translate-y-1/2 flex-col items-end gap-3.5 transition-opacity duration-500 data-[on=false]:pointer-events-none data-[on=false]:opacity-0 sm:flex"
      >
        {CHAPTERS.map((chapter, index) => (
          <button
            key={chapter.id}
            type="button"
            data-goto={index}
            data-on={index === 0}
            aria-label={`Chapter ${index + 1}: ${chapter.label}`}
            aria-current={index === 0 ? "step" : undefined}
            className="group flex items-center gap-2.5 py-0.5"
          >
            <span className="text-xs font-medium text-transparent transition group-hover:text-white/75 group-focus-visible:text-white/75 group-data-[on=true]:text-white/85">
              {chapter.label}
            </span>
            <span className="h-2 w-2 rounded-full ring-1 ring-white/60 transition group-hover:bg-white/60 group-data-[on=true]:scale-125 group-data-[on=true]:bg-gold-bright group-data-[on=true]:ring-0" />
          </button>
        ))}
      </nav>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-[56px] sm:h-[86px]">
        <WaveDivider />
      </div>

      <p className="pointer-events-none absolute bottom-[62px] right-3 z-20 text-[10px] text-white/55 sm:bottom-[92px]">{PHASES.sunset.credit}</p>

      <StoryController world={WORLD_ENABLED} />
    </div>
  );
}

/** Words reveal one at a time for sighted readers; assistive tech reads the phrase whole. */
function Words({ text, offset = 0 }: { text: string; offset?: number }) {
  return (
    <>
      <span className="sr-only">{text}</span>
      <span aria-hidden>
        {text.split(" ").map((word, i) => (
          <span key={`${word}-${i}`}>
            {i > 0 && " "}
            <span className="sw-word" style={{ "--i": i + offset } as CSSProperties}>
              {word}
            </span>
          </span>
        ))}
      </span>
    </>
  );
}

const wordCount = (text: string) => text.split(" ").length;

function Intro({ chapter }: { chapter: Chapter }) {
  return (
    <div className="max-w-3xl">
      <h1
        id={`story-${chapter.id}-title`}
        className="font-display text-[2.6rem] font-semibold leading-[1.03] text-white [text-shadow:0_1px_10px_rgba(7,28,41,0.45)] sm:text-7xl"
      >
        <Words text={chapter.title} />
        <br />
        <span className="text-gold-bright">
          <Words text={chapter.accent ?? ""} offset={wordCount(chapter.title)} />
        </span>
      </h1>
      <p className="sw-reveal mt-5 max-w-xl text-[15px] leading-relaxed text-white/85 sm:text-lg" style={{ "--d": "260ms" } as CSSProperties}>
        {chapter.body}
      </p>
      <div className="sw-reveal mt-8 max-w-2xl" style={{ "--d": "380ms" } as CSSProperties}>
        <HeroPrompt picks={cityPicks(QUICK_PICKS)} />
      </div>
    </div>
  );
}

function Beat({ chapter, last }: { chapter: Chapter; last: boolean }) {
  return (
    <div className="max-w-xl">
      <h2
        id={`story-${chapter.id}-title`}
        className="font-display text-[2.4rem] font-semibold leading-[1.05] text-white [text-shadow:0_1px_10px_rgba(7,28,41,0.5)] sm:text-6xl"
      >
        <Words text={chapter.title} />{" "}
        {chapter.accent && (
          <span className="text-gold-bright">
            <Words text={chapter.accent} offset={wordCount(chapter.title)} />
          </span>
        )}
      </h2>
      <p className="sw-reveal mt-5 text-[15px] leading-relaxed text-white/85 sm:text-lg" style={{ "--d": "240ms" } as CSSProperties}>
        {chapter.body}
      </p>
      {last && (
        <div className="sw-reveal mt-8 flex flex-wrap gap-3" style={{ "--d": "360ms" } as CSSProperties}>
          <Link href="/plan" className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-deep transition hover:bg-gold-bright">
            Plan a trip
          </Link>
          <Link href="#destinations" className="rounded-full px-6 py-3 text-sm font-semibold text-white ring-1 ring-white/40 transition hover:bg-white/10">
            Explore destinations
          </Link>
        </div>
      )}
    </div>
  );
}
