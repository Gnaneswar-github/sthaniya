"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { HeroPrompt } from "./Hero";
import { WaveDivider } from "./PageHero";
import { CHAPTERS, type Chapter } from "./scroll-world/chapters";
import type { FromWorld, ToWorld } from "./scroll-world/world.worker";
import { PHASES, type Phase } from "@/lib/phases";

/**
 * The live Three.js island is opt-in. Measured on a laptop with integrated graphics it still
 * competed with scrolling and typing for the GPU — a 736 ms stalled keystroke at start-up — so
 * the default story is told with photographs that crossfade on the compositor, which never
 * blocks input. Set NEXT_PUBLIC_HERO_3D=1 to bring the island back on capable hardware.
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

type Status = "loading" | "ready" | "fallback";

/**
 * Exact chapter progress from native scroll: the integer part is the chapter, the fraction is
 * travel toward the next. Holds no history, so fast jumps, reverse scroll and reload-at-depth
 * all reproduce the same state.
 */
function progressFrom(tops: number[], y: number) {
  const last = tops.length - 1;
  if (last <= 0 || y <= tops[0]) return 0;
  for (let i = 0; i < last; i++) {
    if (y < tops[i + 1]) return i + (y - tops[i]) / Math.max(1, tops[i + 1] - tops[i]);
  }
  return last;
}

/**
 * The homepage story. Native scroll is the only input: the exact progress picks the chapter,
 * which reveals its copy and fades in that chapter's photograph. Every word, link and the trip
 * prompt are real DOM; the imagery behind them is decoration.
 */
export function ScrollWorld({ nav }: { nav: ReactNode }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<(HTMLElement | null)[]>([]);
  const topsRef = useRef<number[]>([]);
  const [active, setActive] = useState(0);
  const [status, setStatus] = useState<Status>("loading");
  const [railShown, setRailShown] = useState(true);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    let disposed = false;
    let shown = 0;
    let worker: Worker | null = null;
    let pendingProgress = 0;
    let canvas: HTMLCanvasElement | null = null;

    const measure = () => {
      topsRef.current = sectionRefs.current.map((el) => (el ? el.getBoundingClientRect().top + window.scrollY : 0));
    };
    const exact = () => progressFrom(topsRef.current, window.scrollY);
    const send = (message: ToWorld, transfer: Transferable[] = []) => worker?.postMessage(message, transfer);

    const onScroll = () => {
      const next = Math.round(exact());
      if (next !== shown) {
        shown = next;
        setActive(next);
      }
      if (worker && !pendingProgress) {
        pendingProgress = requestAnimationFrame(() => {
          pendingProgress = 0;
          send({ type: "progress", value: exact() });
        });
      }
    };

    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    const resize = new ResizeObserver(measure);
    resize.observe(document.documentElement);

    // The rail sits at the middle of the screen, so it belongs to the story only while the story
    // still covers that middle band — not while the wave is leaving and paper sits behind it.
    const rail = new IntersectionObserver(([entry]) => setRailShown(entry.isIntersecting), { rootMargin: "-45% 0px -45% 0px" });
    rail.observe(wrap);

    const cleanups: (() => void)[] = [];
    if (WORLD_ENABLED && stageRef.current) cleanups.push(startWorld(stageRef.current));


    function startWorld(stage: HTMLDivElement) {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
      // Drawn at most ~1280 device pixels wide and scaled up by the compositor.
      const pixelRatio = () => Math.max(0.5, Math.min(window.devicePixelRatio || 1, 1280 / Math.max(1, window.innerWidth), 1.5));
      canvas = document.createElement("canvas");
      canvas.className = "absolute inset-0 h-full w-full";
      stage.appendChild(canvas);

      const device = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
      const modest = (device.hardwareConcurrency ?? 8) <= 4 || (device.deviceMemory ?? 8) <= 4 || device.connection?.saveData === true;
      if (modest || typeof Worker === "undefined" || typeof canvas.transferControlToOffscreen !== "function") {
        return () => canvas?.remove();
      }

      const onResize = () => send({ type: "resize", width: window.innerWidth, height: window.innerHeight, pixelRatio: pixelRatio() });
      window.addEventListener("resize", onResize);
      const visibility = new IntersectionObserver(([entry]) => send({ type: "running", value: entry.isIntersecting && !document.hidden }));
      visibility.observe(wrap!);
      const onHidden = () => send({ type: "running", value: !document.hidden });
      document.addEventListener("visibilitychange", onHidden);

      worker = new Worker(new URL("./scroll-world/world.worker.ts", import.meta.url), { type: "module" });
      worker.onmessage = ({ data }: MessageEvent<FromWorld>) => {
        if (disposed) return;
        if (data.type === "failed") {
          worker?.terminate();
          worker = null;
          setStatus("fallback");
        } else {
          setStatus("ready");
        }
      };
      const offscreen = canvas.transferControlToOffscreen();
      send(
        { type: "init", canvas: offscreen, width: window.innerWidth, height: window.innerHeight, pixelRatio: pixelRatio(), progress: exact(), reduced: reduced.matches },
        [offscreen],
      );

      return () => {
        window.removeEventListener("resize", onResize);
        visibility.disconnect();
        document.removeEventListener("visibilitychange", onHidden);
        worker?.terminate();
        worker = null;
        canvas?.remove();
      };
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(pendingProgress);
      window.removeEventListener("scroll", onScroll);
      resize.disconnect();
      rail.disconnect();
      cleanups.forEach((cleanup) => cleanup());
    };
  }, []);

  function goTo(index: number) {
    const top = topsRef.current[index];
    if (top === undefined) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top, behavior: reduced ? "auto" : "smooth" });
  }

  const activePhase = CHAPTER_PHASE[Math.min(active, CHAPTER_PHASE.length - 1)];

  return (
    <div ref={wrapRef} className="relative isolate bg-deep-2">
      {nav}

      {/* One persistent layer for the whole story. Sticky, not fixed, so nothing intercepts the
          wheel — and bounded by an absolute track the exact height of the story. */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="sticky top-0 h-[100svh] overflow-hidden">
          {/* One photograph for the whole story; each chapter's time of day is a light tint over it.
              Four full-screen photos meant four large decodes and GPU uploads — measured as a
              stalled keystroke — while a tint is a gradient the compositor fades for free. */}
          <Image
            src={PHASES.sunset.image}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-[60%_center]"
          />
          {PHOTO_LAYERS.map((phase) => (
            <div
              key={phase}
              className={`sw-tint absolute inset-0 transition-opacity duration-1000 ease-out ${TINT[phase]} ${phase === activePhase ? "opacity-100" : "opacity-0"}`}
            />
          ))}
          {WORLD_ENABLED && (
            <div
              ref={stageRef}
              className={`absolute inset-0 transition-opacity duration-700 ease-out ${status === "ready" ? "opacity-100" : "opacity-0"}`}
            />
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
          ref={(el) => {
            sectionRefs.current[index] = el;
          }}
          data-active={active === index}
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
        aria-label="Story chapters"
        className={`fixed right-4 top-1/2 z-20 hidden -translate-y-1/2 flex-col items-end gap-3.5 transition-opacity duration-500 sm:flex ${
          railShown ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        {CHAPTERS.map((chapter, index) => (
          <button
            key={chapter.id}
            type="button"
            onClick={() => goTo(index)}
            aria-label={`Chapter ${index + 1}: ${chapter.label}`}
            aria-current={active === index ? "step" : undefined}
            className="group flex items-center gap-2.5 py-0.5"
          >
            <span
              className={`text-xs font-medium transition ${
                active === index ? "text-white/85" : "text-transparent group-hover:text-white/75 group-focus-visible:text-white/75"
              }`}
            >
              {chapter.label}
            </span>
            <span
              className={`h-2 w-2 rounded-full transition ${
                active === index ? "scale-125 bg-gold-bright" : "ring-1 ring-white/60 group-hover:bg-white/60"
              }`}
            />
          </button>
        ))}
      </nav>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-[56px] sm:h-[86px]">
        <WaveDivider />
      </div>

      <p className="pointer-events-none absolute bottom-[62px] right-3 z-20 text-[10px] text-white/55 sm:bottom-[92px]">
        {PHASES.sunset.credit}
      </p>
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
      <p
        className="sw-reveal mt-5 max-w-xl text-[15px] leading-relaxed text-white/85 sm:text-lg"
        style={{ "--d": "260ms" } as CSSProperties}
      >
        {chapter.body}
      </p>
      <div className="sw-reveal mt-8 max-w-2xl" style={{ "--d": "380ms" } as CSSProperties}>
        <HeroPrompt />
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
      <p
        className="sw-reveal mt-5 text-[15px] leading-relaxed text-white/85 sm:text-lg"
        style={{ "--d": "240ms" } as CSSProperties}
      >
        {chapter.body}
      </p>
      {last && (
        <div className="sw-reveal mt-8 flex flex-wrap gap-3" style={{ "--d": "360ms" } as CSSProperties}>
          <Link href="/plan" className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-deep transition hover:bg-gold-bright">
            Plan a trip
          </Link>
          <Link
            href="#destinations"
            className="rounded-full px-6 py-3 text-sm font-semibold text-white ring-1 ring-white/40 transition hover:bg-white/10"
          >
            Explore destinations
          </Link>
        </div>
      )}
    </div>
  );
}
