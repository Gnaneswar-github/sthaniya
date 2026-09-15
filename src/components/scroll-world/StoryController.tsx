"use client";

import { useEffect } from "react";
import type { FromWorld, ToWorld } from "./world.worker";

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

const setOn = (element: Element, on: boolean) => element.setAttribute("data-on", String(on));

/**
 * Drives the server-rendered homepage story. It renders nothing: it marks the active chapter, its
 * time-of-day tint and the chapter rail by attribute, and CSS does the rest. Keeping the story out
 * of React means hydrating the homepage costs only the trip prompt, and scrolling never re-renders.
 */
export function StoryController({ world = false }: { world?: boolean }) {
  useEffect(() => {
    const wrap = document.querySelector<HTMLElement>("[data-story]");
    if (!wrap) return;
    const sections = [...wrap.querySelectorAll<HTMLElement>("[data-chapter]")];
    const tints = [...wrap.querySelectorAll<HTMLElement>("[data-tint]")];
    const rail = wrap.querySelector<HTMLElement>("[data-rail]");
    const dots = rail ? [...rail.querySelectorAll<HTMLElement>("[data-goto]")] : [];

    let disposed = false;
    let tops: number[] = [];
    let shown = 0;
    let worker: Worker | null = null;
    let pendingProgress = 0;

    // Measured from the resize observer's first callback rather than on mount, so hydration never
    // forces a synchronous layout just to learn where the chapters are.
    const measure = () => {
      tops = sections.map((el) => el.getBoundingClientRect().top + window.scrollY);
    };
    const exact = () => {
      if (tops.length === 0) measure();
      return progressFrom(tops, window.scrollY);
    };
    const send = (message: ToWorld, transfer: Transferable[] = []) => worker?.postMessage(message, transfer);

    const show = (index: number) => {
      const phase = sections[index]?.dataset.phase;
      sections.forEach((el, i) => el.setAttribute("data-active", String(i === index)));
      tints.forEach((el) => setOn(el, el.dataset.tint === phase));
      dots.forEach((el, i) => {
        setOn(el, i === index);
        if (i === index) el.setAttribute("aria-current", "step");
        else el.removeAttribute("aria-current");
      });
    };

    const onScroll = () => {
      const next = Math.round(exact());
      if (next !== shown) {
        shown = next;
        show(next);
      }
      if (worker && !pendingProgress) {
        pendingProgress = requestAnimationFrame(() => {
          pendingProgress = 0;
          send({ type: "progress", value: exact() });
        });
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    const resize = new ResizeObserver(() => {
      measure();
      if (window.scrollY > 0) onScroll();
    });
    resize.observe(document.documentElement);

    // The rail sits at the middle of the screen, so it belongs to the story only while the story
    // still covers that middle band — not while the wave is leaving and paper sits behind it.
    const railBand = new IntersectionObserver(([entry]) => rail && setOn(rail, entry.isIntersecting), { rootMargin: "-45% 0px -45% 0px" });
    railBand.observe(wrap);

    const onRailClick = (event: MouseEvent) => {
      const dot = (event.target as Element).closest<HTMLElement>("[data-goto]");
      if (!dot) return;
      if (tops.length === 0) measure();
      const top = tops[Number(dot.dataset.goto)];
      if (top === undefined) return;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top, behavior: reduced ? "auto" : "smooth" });
    };
    rail?.addEventListener("click", onRailClick);

    const cleanups: (() => void)[] = [];
    const stage = world ? wrap.querySelector<HTMLElement>("[data-world-stage]") : null;
    if (stage) cleanups.push(startWorld(stage));

    function startWorld(stageElement: HTMLElement) {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
      // Drawn at most ~1280 device pixels wide and scaled up by the compositor.
      const pixelRatio = () => Math.max(0.5, Math.min(window.devicePixelRatio || 1, 1280 / Math.max(1, window.innerWidth), 1.5));
      const canvas = document.createElement("canvas");
      canvas.className = "absolute inset-0 h-full w-full";
      stageElement.appendChild(canvas);

      const device = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
      const modest = (device.hardwareConcurrency ?? 8) <= 4 || (device.deviceMemory ?? 8) <= 4 || device.connection?.saveData === true;
      if (modest || typeof Worker === "undefined" || typeof canvas.transferControlToOffscreen !== "function") {
        return () => canvas.remove();
      }

      const onResize = () => send({ type: "resize", width: window.innerWidth, height: window.innerHeight, pixelRatio: pixelRatio() });
      window.addEventListener("resize", onResize);
      const visibility = new IntersectionObserver(([entry]) => send({ type: "running", value: entry.isIntersecting && !document.hidden }));
      visibility.observe(wrap!);
      const onHidden = () => send({ type: "running", value: !document.hidden });
      document.addEventListener("visibilitychange", onHidden);

      worker = new Worker(new URL("./world.worker.ts", import.meta.url), { type: "module" });
      worker.onmessage = ({ data }: MessageEvent<FromWorld>) => {
        if (disposed) return;
        if (data.type === "failed") {
          worker?.terminate();
          worker = null;
        } else {
          setOn(stageElement, true);
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
        canvas.remove();
      };
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(pendingProgress);
      window.removeEventListener("scroll", onScroll);
      resize.disconnect();
      railBand.disconnect();
      rail?.removeEventListener("click", onRailClick);
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [world]);

  return null;
}
