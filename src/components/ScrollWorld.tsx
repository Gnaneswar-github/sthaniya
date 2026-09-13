"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { HeroPrompt } from "./Hero";
import { WaveDivider } from "./PageHero";
import { CHAPTERS, type Chapter } from "./scroll-world/chapters";
import type { WorldHandle } from "./scroll-world/world";
import { PHASES } from "@/lib/phases";

declare global {
  interface Window {
    /** Development-only handle for inspecting the world from the console or tests. */
    __sthaniyaWorld?: WorldHandle;
  }
}

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
 * The homepage story as one persistent Three.js world. Native scroll is the only input: the
 * exact progress drives the copy and the chapter rail, a damped copy of it drives the camera.
 * The canvas is decoration — every word, link and the trip prompt are real DOM above it, and
 * the photograph stands in whenever WebGL can't.
 */
export function ScrollWorld({ nav }: { nav: ReactNode }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sectionRefs = useRef<(HTMLElement | null)[]>([]);
  const topsRef = useRef<number[]>([]);
  const [active, setActive] = useState(0);
  const [status, setStatus] = useState<Status>("loading");
  const [inView, setInView] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let world: WorldHandle | null = null;
    let raf = 0;
    let running = false;
    let visible = true;
    let disposed = false;
    let render = 0;
    let last = performance.now();
    let shown = 0;

    const measure = () => {
      topsRef.current = sectionRefs.current.map((el) =>
        el ? el.getBoundingClientRect().top + window.scrollY : 0,
      );
    };
    const exact = () => progressFrom(topsRef.current, window.scrollY);
    const syncDom = (p: number) => {
      const next = Math.round(p);
      if (next !== shown) {
        shown = next;
        setActive(next);
      }
    };

    const frame = (now: number) => {
      // Clamp after stalls or a resumed tab so damping never lurches.
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      const p = exact();
      syncDom(p);
      if (reduced.matches) {
        render = Math.round(p);
      } else {
        render += (p - render) * (1 - Math.exp(-5.2 * dt));
        if (Math.abs(p - render) < 1e-4) render = p;
      }
      world?.update(render, reduced.matches ? 0 : dt);
      raf = requestAnimationFrame(frame);
    };
    const start = () => {
      if (running || !world || !visible || document.hidden) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    measure();
    const onScroll = () => syncDom(exact());
    window.addEventListener("scroll", onScroll, { passive: true });

    const resize = new ResizeObserver(() => {
      measure();
      world?.resize(window.innerWidth, window.innerHeight);
    });
    resize.observe(document.documentElement);

    // Nothing renders once the story has scrolled away and the paper sections take over.
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      setInView(entry.isIntersecting);
      if (visible) start();
      else stop();
    });
    intersection.observe(wrap);

    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVisibility);

    const onContextLost = (event: Event) => {
      event.preventDefault();
      stop();
      setStatus("fallback");
    };
    canvas.addEventListener("webglcontextlost", onContextLost);

    import("./scroll-world/world")
      .then(({ createWorld }) => {
        if (disposed) return;
        world = createWorld(canvas, CHAPTERS);
        if (!world) {
          setStatus("fallback");
          return;
        }
        if (process.env.NODE_ENV !== "production") window.__sthaniyaWorld = world;
        world.resize(window.innerWidth, window.innerHeight);
        const p = exact();
        render = reduced.matches ? Math.round(p) : p;
        world.update(render, 0);
        setStatus("ready");
        start();
      })
      .catch(() => setStatus("fallback"));

    return () => {
      disposed = true;
      stop();
      window.removeEventListener("scroll", onScroll);
      resize.disconnect();
      intersection.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      world?.dispose();
      world = null;
      delete window.__sthaniyaWorld;
    };
  }, []);

  function goTo(index: number) {
    const top = topsRef.current[index];
    if (top === undefined) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top, behavior: reduced ? "auto" : "smooth" });
  }

  return (
    <div ref={wrapRef} className="relative isolate bg-deep-2">
      {nav}

      {/* One persistent layer for the whole story. Sticky, not fixed: it scrolls away with the
          story, and nothing ever intercepts the wheel. */}
      <div aria-hidden className="sticky top-0 -mb-[100svh] h-[100svh] overflow-hidden">
        {status !== "ready" && (
          <>
            <Image
              src={PHASES.sunset.image}
              alt=""
              fill
              priority
              sizes="100vw"
              className="object-cover object-[60%_center]"
            />
            <div className={`absolute inset-0 ${PHASES.sunset.wash}`} />
          </>
        )}
        <canvas
          ref={canvasRef}
          className={`absolute inset-0 h-full w-full transition-opacity duration-1000 ${
            status === "ready" ? "opacity-100" : "opacity-0"
          }`}
        />
        {/* Authored scrims keep copy legible over every time of day. */}
        <div className="absolute inset-0 bg-gradient-to-t from-deep-2/85 via-deep-2/25 to-deep-2/35 sm:bg-gradient-to-r sm:from-deep-2/80 sm:via-deep-2/30 sm:to-transparent" />
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-deep-2/60 to-transparent" />
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
            {index === 0 ? (
              <Intro chapter={chapter} />
            ) : (
              <Beat chapter={chapter} index={index} last={index === CHAPTERS.length - 1} />
            )}
          </div>
        </section>
      ))}

      <nav
        aria-label="Story chapters"
        className={`fixed right-4 top-1/2 z-20 hidden -translate-y-1/2 flex-col items-end gap-3.5 transition-opacity duration-500 sm:flex ${
          inView ? "opacity-100" : "pointer-events-none opacity-0"
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
              className={`text-[10px] font-semibold uppercase tracking-[0.2em] transition ${
                active === index
                  ? "text-white/80"
                  : "text-transparent group-hover:text-white/70 group-focus-visible:text-white/70"
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

      {status !== "ready" && (
        <p className="pointer-events-none absolute bottom-[62px] right-3 z-20 text-[10px] text-white/45 sm:bottom-[92px]">
          {PHASES.sunset.credit}
        </p>
      )}
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
      <p className="sw-reveal text-[11px] font-semibold uppercase tracking-[0.28em] text-white/70">
        {chapter.eyebrow}
      </p>
      <h1
        id={`story-${chapter.id}-title`}
        className="mt-4 font-display text-[2.6rem] font-semibold leading-[1.03] text-white [text-shadow:0_2px_30px_rgba(7,28,41,0.55)] sm:text-7xl"
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

function Beat({ chapter, index, last }: { chapter: Chapter; index: number; last: boolean }) {
  return (
    <div className="max-w-xl">
      <p className="sw-reveal text-[11px] font-semibold uppercase tracking-[0.28em] text-gold-bright/90">
        <span className="tabular-nums">{String(index + 1).padStart(2, "0")}</span>
        <span className="mx-2 text-white/40">/</span>
        {chapter.eyebrow}
      </p>
      <h2
        id={`story-${chapter.id}-title`}
        className="mt-3 font-display text-[2.4rem] font-semibold leading-[1.05] text-white [text-shadow:0_2px_30px_rgba(7,28,41,0.6)] sm:text-6xl"
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
          <Link
            href="/plan"
            className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-deep transition hover:bg-gold-bright"
          >
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
