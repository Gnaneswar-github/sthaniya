"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import { KIND_LABEL, type Destination } from "@/lib/destinations/types";
import { readMigrated } from "@/lib/trip-storage";

const RECENTS_KEY = "nativa.recentDestinations";
const LEGACY_RECENTS_KEY = "sthaniya.recentDestinations";
const MAX_RECENTS = 5;

type Status = "idle" | "loading" | "ready" | "error";

function readRecents(): Destination[] {
  try {
    const raw = readMigrated(RECENTS_KEY, LEGACY_RECENTS_KEY);
    return raw ? (JSON.parse(raw) as Destination[]) : [];
  } catch {
    return [];
  }
}

function pushRecent(destination: Destination) {
  try {
    const next = [destination, ...readRecents().filter((d) => d.id !== destination.id)].slice(
      0,
      MAX_RECENTS,
    );
    window.localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch {
    // Recents are a convenience; losing them is not an error worth surfacing.
  }
}

/**
 * Reusable destination picker. Knows nothing about any particular country: it renders whatever
 * the destination service returns, including places with no imagery, which is most of the world.
 */
export function DestinationSelector({
  value,
  onSelect,
  placeholder = "Search any city, country, island or neighbourhood",
  autoFocus = false,
}: {
  value?: Destination | null;
  onSelect: (destination: Destination) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const listId = useId();
  const [text, setText] = useState("");
  const [results, setResults] = useState<Destination[]>([]);
  const [starters, setStarters] = useState<Destination[]>([]);
  const [recents, setRecents] = useState<Destination[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [degraded, setDegraded] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  const term = text.trim();
  const searching = term.length >= 2;

  useEffect(() => {
    // Both reads happen off the synchronous effect body: localStorage isn't available during
    // server render, and starters come from the network anyway.
    Promise.resolve().then(() => setRecents(readRecents()));
    fetch("/api/destinations/search")
      .then((r) => r.json())
      .then((data: { results?: Destination[] }) => setStarters(data.results ?? []))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!searching) return;

    const controller = new AbortController();
    const timer = setTimeout(() => {
      setStatus("loading");
      fetch(`/api/destinations/search?q=${encodeURIComponent(term)}`, { signal: controller.signal })
        .then((response) => (response.ok ? response.json() : Promise.reject(new Error("search"))))
        .then((data: { results?: Destination[]; degraded?: boolean }) => {
          setResults(data.results ?? []);
          setDegraded(Boolean(data.degraded));
          setStatus("ready");
          setActive(0);
        })
        .catch((error: Error) => {
          if (error.name === "AbortError") return;
          setStatus("error");
        });
    }, 280);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [term, searching]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const options = searching ? results : recents.length > 0 ? recents : starters;

  function choose(destination: Destination) {
    pushRecent(destination);
    setRecents(readRecents());
    setText("");
    setOpen(false);
    onSelect(destination);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (!open || options.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => (i + 1) % options.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => (i - 1 + options.length) % options.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      choose(options[active]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={boxRef} className="relative">
      <input
        value={text}
        autoFocus={autoFocus}
        onChange={(event) => {
          setText(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        placeholder={value ? value.name : placeholder}
        className="w-full rounded-xl border border-line bg-paper px-4 py-3 text-[15px] text-ink outline-none placeholder:text-ink-faint/70 focus:border-brand"
      />

      {open && (
        <div
          id={listId}
          role="listbox"
          className="absolute z-40 mt-1 w-full overflow-hidden rounded-2xl border border-line bg-paper-raised shadow-[0_18px_44px_-26px_rgba(32,27,23,0.65)]"
        >
          {!searching && (
            <p className="border-b border-line px-4 py-2 text-xs font-medium text-ink-faint">
              {recents.length > 0 ? "Recent searches" : "Start somewhere"}
            </p>
          )}

          {searching && status === "loading" && <SkeletonRows />}

          {searching && status === "error" && (
            <div className="px-4 py-5 text-sm text-ink-soft">
              <p className="text-ink">Destination search is unavailable right now.</p>
              <p className="mt-1 text-ink-faint">
                You can still type a destination by hand and carry on.
              </p>
            </div>
          )}

          {searching && status === "ready" && options.length === 0 && (
            <div className="px-4 py-5 text-sm">
              <p className="text-ink">Nothing matched &ldquo;{term}&rdquo;.</p>
              <p className="mt-1 text-ink-faint">
                Try a nearby city, or add the country — &ldquo;Colombo Sri Lanka&rdquo;.
              </p>
            </div>
          )}

          {(status !== "loading" || !searching) && options.length > 0 && (
            <ul className="max-h-80 overflow-y-auto py-1">
              {options.map((destination, index) => (
                <li key={destination.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={index === active}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => choose(destination)}
                    className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition ${
                      index === active ? "bg-paper" : ""
                    }`}
                  >
                    <Thumb destination={destination} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-2">
                        <span className="truncate text-[15px] text-ink">{destination.name}</span>
                        {destination.guideSlug && (
                          <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-brand/10 px-1.5 py-px text-[11px] font-semibold text-brand-deep">
                            <BookIcon /> City guide
                          </span>
                        )}
                      </span>
                      <span className="block truncate text-xs text-ink-faint">
                        {KIND_LABEL[destination.kind]}
                        {destination.context ? ` · ${destination.context}` : ""}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {degraded && status === "ready" && (
            <p className="border-t border-line px-4 py-2 text-[11px] text-gold">
              Some results are missing — one of our sources didn&rsquo;t respond.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function BookIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5v-15Z" />
      <path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5" />
    </svg>
  );
}

function Thumb({ destination }: { destination: Destination }) {
  if (destination.thumbnailUrl) {
    return (
      <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg">
        <Image src={destination.thumbnailUrl} alt="" fill sizes="40px" className="object-cover" />
      </span>
    );
  }

  // Most of the world has no image, so the placeholder is a first-class state, not a fallback.
  return (
    <span
      aria-hidden
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-paper-sunken font-display text-sm text-ink-faint"
    >
      {destination.name.charAt(0)}
    </span>
  );
}

function SkeletonRows() {
  return (
    <ul className="py-1">
      {[0, 1, 2].map((row) => (
        <li key={row} className="flex items-center gap-3 px-3 py-2.5">
          <span className="h-10 w-10 shrink-0 animate-pulse rounded-lg bg-paper-sunken" />
          <span className="flex-1 space-y-1.5">
            <span className="block h-3 w-1/2 animate-pulse rounded bg-paper-sunken" />
            <span className="block h-2.5 w-1/3 animate-pulse rounded bg-paper-sunken" />
          </span>
        </li>
      ))}
    </ul>
  );
}
