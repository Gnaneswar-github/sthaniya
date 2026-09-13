"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const EXAMPLES = [
  "3 days in Tokyo with my wife. We love local food, quiet temples and photography. We don't like crowded tourist attractions. Budget around $200 per day.",
  "A long weekend in Lisbon, solo. Old streets, cafés, nothing touristy. Relaxed pace.",
  "5 days in Istanbul with friends — markets, street food and photography, around €90 per day.",
  "2 days in Pune. First time, travelling with family, we want the must-see places.",
];

type Suggestion = {
  id: string;
  name: string;
  context: string;
  tier: "verified" | "sourced";
};

export function Hero() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const [placeholder, setPlaceholder] = useState(EXAMPLES[0]);
  const boxRef = useRef<HTMLDivElement>(null);

  // Rotate the example so the box reads as a prompt, not a template to fill in.
  useEffect(() => {
    const timer = setInterval(() => {
      setPlaceholder((current) => EXAMPLES[(EXAMPLES.indexOf(current) + 1) % EXAMPLES.length]);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  // A long sentence is a description, not a search box — so whether suggestions apply at all
  // is derived from the text rather than stored, and the effect only ever fetches.
  const term = text.trim();
  const searchable = term.length >= 2 && term.length <= 32 && !term.includes(" in ");
  const visible = searchable && !dismissed ? suggestions : [];

  useEffect(() => {
    if (!searchable) return;

    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/destinations/search?q=${encodeURIComponent(term)}`, { signal: controller.signal })
        .then((r) => r.json())
        .then((data) => setSuggestions(data.suggestions ?? []))
        .catch(() => undefined);
    }, 280);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [term, searchable]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (!boxRef.current?.contains(event.target as Node)) setDismissed(true);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function go(value: string) {
    if (!value.trim()) return;
    router.push(`/plan?q=${encodeURIComponent(value.trim())}`);
  }

  return (
    <section className="relative overflow-hidden rounded-3xl border border-line bg-paper-raised">
      <div className="absolute inset-0" aria-hidden>
        <div className="h-full w-full bg-gradient-to-br from-terracotta/12 via-saffron/8 to-moss/12" />
      </div>

      <div className="relative px-5 py-12 sm:px-10 sm:py-16">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-terracotta">
          Anywhere in the world
        </p>
        <h1 className="mt-3 max-w-2xl font-display text-4xl leading-[1.05] text-ink sm:text-6xl">
          Where do you want to go?
        </h1>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ink-soft sm:text-lg">
          Describe the trip the way you&rsquo;d describe it to a friend. Sthānīya reads it,
          shows you what it understood, and builds something you can argue with.
        </p>

        <div ref={boxRef} className="relative mt-7 max-w-2xl">
          <textarea
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              setDismissed(false);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) go(text);
            }}
            rows={3}
            aria-label="Describe your trip"
            placeholder={placeholder}
            className="w-full resize-none rounded-2xl border border-line-strong bg-paper-raised px-5 py-4 text-[15px] leading-relaxed text-ink shadow-[0_2px_20px_-12px_rgba(32,27,23,0.4)] outline-none placeholder:text-ink-faint/70 focus:border-terracotta sm:text-base"
          />

          {visible.length > 0 && (
            <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-2xl border border-line bg-paper-raised shadow-[0_18px_40px_-24px_rgba(32,27,23,0.6)]">
              {visible.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => go(item.name)}
                    className="flex w-full items-baseline justify-between gap-3 px-4 py-2.5 text-left transition hover:bg-paper"
                  >
                    <span className="text-[15px] text-ink">{item.name}</span>
                    <span className="shrink-0 text-xs text-ink-faint">
                      {item.tier === "verified" ? "✓ Verified" : item.context}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => go(text)}
              disabled={!text.trim()}
              className="rounded-xl bg-ink px-5 py-3 text-sm font-medium text-paper transition enabled:hover:bg-terracotta disabled:opacity-30"
            >
              Read my trip
            </button>
            <button
              type="button"
              onClick={() => setText(EXAMPLES[Math.floor(Math.random() * EXAMPLES.length)])}
              className="rounded-xl border border-line-strong px-4 py-3 text-sm text-ink-soft transition hover:border-terracotta hover:text-terracotta"
            >
              Try an example
            </button>
            <span className="hidden text-xs text-ink-faint sm:inline">or press ⌘↵</span>
          </div>
        </div>
      </div>
    </section>
  );
}
