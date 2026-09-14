/**
 * The homepage world, running entirely off the main thread. The page transfers its canvas here
 * and then only sends numbers — scroll progress, size, whether the story is on screen — so
 * building the island, compiling shaders and drawing every frame can never delay a scroll, a
 * keystroke or a paint on the page itself.
 */
import { CHAPTERS } from "./chapters";
import { createWorld, type WorldHandle } from "./world";

export type ToWorld =
  | { type: "init"; canvas: OffscreenCanvas; width: number; height: number; pixelRatio: number; progress: number; reduced: boolean }
  | { type: "progress"; value: number }
  | { type: "resize"; width: number; height: number; pixelRatio: number }
  | { type: "running"; value: boolean }
  | { type: "reduced"; value: boolean };

export type FromWorld = { type: "ready" } | { type: "failed" };

type WorkerScope = {
  postMessage: (message: FromWorld) => void;
  onmessage: ((event: MessageEvent<ToWorld>) => void) | null;
  requestAnimationFrame?: (callback: (now: number) => void) => number;
  cancelAnimationFrame?: (handle: number) => void;
};
const scope = self as unknown as WorkerScope;

let world: WorldHandle | null = null;
let target = 0;
let shown = 0;
let running = true;
let reduced = false;
let last = 0;
let lastDraw = 0;
let handle = 0;
let looping = false;

/** While the camera is at rest only the sea, boats and birds move, and 30 frames a second is plenty. */
const SETTLED_FRAME_MS = 33;

const schedule = (callback: (now: number) => void) =>
  scope.requestAnimationFrame ? scope.requestAnimationFrame(callback) : (setTimeout(() => callback(performance.now()), 16) as unknown as number);
const unschedule = (id: number) => (scope.cancelAnimationFrame ? scope.cancelAnimationFrame(id) : clearTimeout(id));

function frame(now: number) {
  if (!world || !running) {
    looping = false;
    return;
  }
  const settled = shown === target;
  // At rest, halve the GPU work: the page's own compositing gets the frame budget back.
  if (settled && now - lastDraw < SETTLED_FRAME_MS) {
    handle = schedule(frame);
    return;
  }
  // Clamp after stalls or a resumed tab so damping never lurches.
  const dt = Math.min((now - last) / 1000, 1 / 20);
  last = now;
  if (reduced) {
    shown = Math.round(target);
  } else {
    shown += (target - shown) * (1 - Math.exp(-5.2 * dt));
    if (Math.abs(target - shown) < 1e-4) shown = target;
  }
  // Under reduced motion nothing moves at rest, so a settled frame never needs redrawing.
  if (!(reduced && settled && lastDraw > 0)) {
    world.update(shown, reduced ? 0 : dt);
    lastDraw = now;
  }
  handle = schedule(frame);
}

function start() {
  if (looping || !world || !running) return;
  looping = true;
  last = performance.now();
  handle = schedule(frame);
}

function stop() {
  looping = false;
  unschedule(handle);
}

scope.onmessage = async ({ data }) => {
  switch (data.type) {
    case "init": {
      target = data.progress;
      reduced = data.reduced;
      data.canvas.addEventListener("contextlost", (event) => {
        event.preventDefault();
        stop();
        scope.postMessage({ type: "failed" });
      });
      try {
        world = await createWorld(data.canvas, CHAPTERS);
      } catch {
        world = null;
      }
      if (!world) {
        scope.postMessage({ type: "failed" });
        return;
      }
      world.resize(data.width, data.height, data.pixelRatio);
      shown = reduced ? Math.round(target) : target;
      world.update(shown, 0);
      scope.postMessage({ type: "ready" });
      start();
      break;
    }
    case "progress":
      target = data.value;
      break;
    case "resize":
      world?.resize(data.width, data.height, data.pixelRatio);
      break;
    case "running":
      running = data.value;
      if (running) start();
      else stop();
      break;
    case "reduced":
      reduced = data.value;
      break;
  }
};
