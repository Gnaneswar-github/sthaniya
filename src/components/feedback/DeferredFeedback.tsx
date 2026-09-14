"use client";

import { useEffect, useState, type ComponentType } from "react";

/**
 * Mounts the feedback button once the page is idle, from its own chunk — it isn't needed for the
 * first paint, and neither is the database client it uses to send notes.
 */
export function DeferredFeedback() {
  const [Widget, setWidget] = useState<ComponentType | null>(null);

  useEffect(() => {
    let live = true;
    const load = () =>
      import("./FeedbackWidget").then((module) => {
        if (live) setWidget(() => module.FeedbackWidget);
      });
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    if (idle) idle(() => void load(), { timeout: 3000 });
    else window.setTimeout(() => void load(), 1500);
    return () => {
      live = false;
    };
  }, []);

  return Widget ? <Widget /> : null;
}
