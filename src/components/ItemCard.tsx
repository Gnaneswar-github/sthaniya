"use client";

import { useState } from "react";
import { Amount } from "./currency/CurrencyControls";
import { StarIcon } from "./icons";
import { MapLink } from "./MapLink";
import { PlaceArt } from "./PlaceArt";
import { clockLabel, durationLabel, placeLocalScore } from "@/lib/trip-engine";
import {
  CATEGORIES,
  LOCALITY_TAGS,
  PRICE_BANDS,
  type ItineraryItem,
  type LocalityTag,
  type Photo,
} from "@/lib/types";

const TAG_PILL: Record<LocalityTag, string> = {
  tourist_essential: "bg-indigo/10 text-indigo",
  local_favourite: "bg-brand/10 text-brand",
  hidden_gem: "bg-moss/10 text-moss",
};

export type ItemCardActions = {
  onReplace: () => void;
  onRemove: () => void;
  onMore: () => void;
  onNotForMe: () => void;
  onShift: (direction: -1 | 1) => void;
  onMoveDay: (dayIndex: number) => void;
  onHover: (itemId: string | null) => void;
};

export function ItemCard({
  item,
  stop,
  color,
  dayIndex,
  dayCount,
  isFirst,
  isLast,
  highlighted,
  whyLine,
  actions,
  date,
  vote,
  onVote,
  tours,
}: {
  item: ItineraryItem;
  stop: number;
  color: string;
  dayIndex: number;
  dayCount: number;
  isFirst: boolean;
  isLast: boolean;
  highlighted: boolean;
  whyLine: string;
  actions: ItemCardActions;
  /** The day this stop is on, so Google's hours can be shown for that weekday. */
  date: string;
  /** Planning together: tallies for this stop and the viewer's own vote. */
  vote?: { up: number; down: number; mine: -1 | 0 | 1; names: string[] };
  onVote?: (value: -1 | 0 | 1) => void;
  /** Tickets and tours, for the kinds of places people book ahead. */
  tours?: { url: string; provider: string; onClick?: () => void };
}) {
  const { place } = item;
  const price = PRICE_BANDS[place.priceBand];
  const end = item.startMinutes + item.durationMinutes;

  return (
    <article
      id={`stop-${item.itemId}`}
      onMouseEnter={() => actions.onHover(item.itemId)}
      onMouseLeave={() => actions.onHover(null)}
      className={`group/card overflow-hidden rounded-3xl border bg-paper-raised transition-all duration-300 ${
        highlighted ? "border-brand/60 shadow-[0_18px_40px_-24px_rgba(13,47,66,0.55)]" : "border-line"
      }`}
    >
      <div className="flex flex-col sm:flex-row">
        <div className="relative h-48 shrink-0 overflow-hidden sm:h-auto sm:min-h-[15rem] sm:w-52">
          <PlaceArt name={place.name} category={place.category} glyphSize={40} className="absolute inset-0 h-full w-full" />
          {place.photo && <PlacePhoto key={place.photo.url} photo={place.photo} alt={place.name} />}

          <span
            className="absolute left-3 top-3 grid h-8 w-8 place-items-center rounded-full text-sm font-semibold tabular-nums text-white shadow-md ring-2 ring-white"
            style={{ background: color }}
            aria-hidden
          >
            {stop}
          </span>
          <span className="no-print absolute right-3 top-3 hidden cursor-grab rounded-full bg-black/35 p-1.5 text-white opacity-0 transition group-hover/card:opacity-100 sm:block" title="Drag to reorder" aria-hidden>
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" /><circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" /><circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" /></svg>
          </span>
        </div>

        <div className="min-w-0 flex-1 space-y-3 p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
            <span className="text-sm font-semibold tabular-nums text-ink">
              {clockLabel(item.startMinutes)} – {clockLabel(end)}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${TAG_PILL[place.tag]}`}>
              {LOCALITY_TAGS[place.tag]}
            </span>
          </div>

          <div>
            <h4 className="text-balance font-display text-2xl leading-tight text-ink">
              <MapLink name={place.name} near={place.destination} />
            </h4>
            <p className="text-sm text-ink-faint">{place.vibe}</p>
            {place.details?.rating != null && (
              <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-sm text-ink-soft" title="Rating and review count from Google Maps">
                <Stars value={place.details.rating} />
                <span className="font-semibold tabular-nums text-ink">{place.details.rating.toFixed(1)}</span>
                {place.details.reviews != null && (
                  <span className="text-ink-faint">({place.details.reviews.toLocaleString()} Google reviews)</span>
                )}
              </p>
            )}
          </div>

          {place.description && <p className="max-w-prose text-[15px] leading-relaxed text-ink-soft">{place.description}</p>}

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-faint">
            <span>{CATEGORIES[place.category]}</span>
            <span aria-hidden>·</span>
            <span>{durationLabel(item.durationMinutes)}</span>
            {/* Decide on the band, never the amount: "unknown" also estimates zero. */}
            {place.priceBand !== "unknown" && (
              <>
                <span aria-hidden>·</span>
                <span>
                  {place.priceBand === "free" ? (
                    "Free"
                  ) : (
                    <>
                      {price.label} ·{" "}
                      <Amount money={{ amount: price.approx, currency: place.costCurrency ?? "USD" }} showConversion />
                    </>
                  )}
                </span>
              </>
            )}
            <span aria-hidden>·</span>
            <span>{placeLocalScore(place)} local</span>
          </div>

          <Hours place={place} date={date} />

          <p className="rounded-2xl bg-paper px-3.5 py-2.5 text-sm leading-relaxed text-ink">
            <span className="font-semibold text-brand">Why it fits: </span>
            {whyLine}
          </p>

          {item.offPreferredWindow && (
            <p className="text-xs italic text-gold">
              Best between {place.timeWindow.start}–{place.timeWindow.end} — move it earlier if you can.
            </p>
          )}

          {(vote || tours) && (
            <div className="no-print flex flex-wrap items-center gap-2">
              {vote && onVote && (
                <span className="inline-flex items-center gap-1 rounded-full bg-paper px-1 py-1 ring-1 ring-line" title={vote.names.length ? `Votes: ${vote.names.join(", ")}` : "No votes yet"}>
                  <VoteButton active={vote.mine === 1} label="Keep this stop" onClick={() => onVote(vote.mine === 1 ? 0 : 1)}>
                    <path d="M7 10v10M17 10h-4l.8-4a1.8 1.8 0 0 0-3.3-1.2L7 10v8a2 2 0 0 0 2 2h6.2a2 2 0 0 0 2-1.6l1.2-6A2 2 0 0 0 16.4 10Z" />
                  </VoteButton>
                  <span className="min-w-[1.25rem] text-center text-xs font-semibold tabular-nums text-ink">{vote.up - vote.down}</span>
                  <VoteButton active={vote.mine === -1} label="Rather skip it" onClick={() => onVote(vote.mine === -1 ? 0 : -1)}>
                    <path d="M7 10v10M17 10h-4l.8-4a1.8 1.8 0 0 0-3.3-1.2L7 10v8a2 2 0 0 0 2 2h6.2a2 2 0 0 0 2-1.6l1.2-6A2 2 0 0 0 16.4 10Z" transform="rotate(180 12 12)" />
                  </VoteButton>
                </span>
              )}
              {tours && (
                <a
                  href={tours.url}
                  target="_blank"
                  rel="sponsored noopener noreferrer"
                  onClick={tours.onClick}
                  className="inline-flex items-center gap-1.5 rounded-full bg-gold/10 px-3 py-2 text-xs font-semibold text-gold transition hover:bg-gold hover:text-white"
                >
                  <svg aria-hidden viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 8a2 2 0 0 0 0 4v5h18v-5a2 2 0 0 0 0-4V5H3ZM13 5v2M13 11v2M13 15v2" /></svg>
                  Tickets &amp; tours
                </a>
              )}
            </div>
          )}

          <div className="no-print flex flex-wrap items-center gap-2 pt-0.5">
            <ActionButton onClick={actions.onMore} tone="brand" label="More like this">
              <path d="M12 5v14M5 12h14" />
            </ActionButton>
            <ActionButton onClick={actions.onNotForMe} label="Not for me">
              <path d="M7 10v10M15.5 20H9.8a2 2 0 0 1-1.96-1.6l-1.2-6A2 2 0 0 1 8.6 10H13l-.8-4a1.8 1.8 0 0 1 3.3-1.2L18 10v8a2 2 0 0 1-2.5 2Z" transform="rotate(180 12 12)" />
            </ActionButton>
            <ActionButton onClick={actions.onReplace} label="Replace">
              <path d="M4 7h13l-3-3M20 17H7l3 3" />
            </ActionButton>
            <ActionButton onClick={actions.onRemove} label="Remove">
              <path d="M6 6l12 12M18 6L6 18" />
            </ActionButton>

            <span className="ml-auto flex items-center gap-1">
              <IconButton label="Move earlier" disabled={isFirst} onClick={() => actions.onShift(-1)}>
                <path d="M12 19V5M6 11l6-6 6 6" />
              </IconButton>
              <IconButton label="Move later" disabled={isLast} onClick={() => actions.onShift(1)}>
                <path d="M12 5v14M6 13l6 6 6-6" />
              </IconButton>
              {dayCount > 1 && (
                <select
                  aria-label="Move to another day"
                  value={dayIndex}
                  onChange={(event) => actions.onMoveDay(Number(event.target.value))}
                  className="h-9 rounded-full border border-line bg-paper-raised px-2.5 text-xs text-ink-soft transition hover:border-brand"
                >
                  {Array.from({ length: dayCount }, (_, i) => (
                    <option key={i} value={i}>
                      Day {i + 1}
                    </option>
                  ))}
                </select>
              )}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}

function Stars({ value }: { value: number }) {
  const row = (className: string) => (
    <span className={`flex w-max gap-px ${className}`}>
      {Array.from({ length: 5 }, (_, i) => (
        <StarIcon key={i} className="h-3.5 w-3.5 shrink-0" />
      ))}
    </span>
  );

  return (
    <span className="relative inline-block" aria-hidden>
      {row("text-line-strong")}
      <span className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${(Math.max(0, Math.min(5, value)) / 5) * 100}%` }}>
        {row("text-gold")}
      </span>
    </span>
  );
}

/** Google's hours for the trip day's weekday when we have them; otherwise OpenStreetMap's listing. */
function Hours({ place, date }: { place: ItineraryItem["place"]; date: string }) {
  const weekday = new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
  const google = place.details?.hours.find((h) => h.day.toLowerCase() === weekday.toLowerCase());
  const text = google ? `${weekday}: ${google.hours}` : place.openingHours;
  if (!text) return null;
  const source = google ? "Google Maps" : "OpenStreetMap";

  return (
    <p className="flex items-start gap-1.5 text-xs text-ink-soft" title={`Opening hours as listed on ${source}`}>
      <svg aria-hidden viewBox="0 0 24 24" className="mt-px h-3.5 w-3.5 shrink-0 text-brand" fill="none" stroke="currentColor" strokeWidth={2}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
      <span className="min-w-0 break-words">
        {text}
        <span className="text-ink-faint"> · {source}</span>
      </span>
    </p>
  );
}

function VoteButton({ children, label, active, onClick }: { children: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={`grid h-8 w-8 place-items-center rounded-full transition ${active ? "bg-brand text-white" : "text-ink-soft hover:bg-paper-sunken hover:text-brand"}`}
    >
      <svg aria-hidden viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </button>
  );
}

/**
 * A real photograph over the generated artwork, faded in once it has loaded. If it fails, the
 * artwork simply stays — never a broken-image icon.
 */
function PlacePhoto({ photo, alt }: { photo: Photo; alt: string }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  if (failed) return null;

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- Wikimedia thumbnails are already sized; proxying them through the image optimiser would re-fetch every photo server-side. */}
      <img
        src={photo.url}
        alt={alt}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        className={`absolute inset-0 h-full w-full object-cover transition-all duration-700 group-hover/card:scale-[1.04] ${loaded ? "opacity-100" : "opacity-0"}`}
      />
      {loaded && (
        <a
          href={photo.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          title={photo.credit}
          className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-3 pb-2 pt-6 text-[10px] text-white/90 hover:text-white"
        >
          {photo.nearby ? "Taken nearby · " : "Photo · "}
          {photo.credit}
        </a>
      )}
    </>
  );
}

function ActionButton({
  children,
  label,
  onClick,
  tone = "neutral",
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  tone?: "brand" | "neutral";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-xs font-medium transition active:scale-[0.97] ${
        tone === "brand"
          ? "border-brand/30 bg-brand/5 text-brand hover:bg-brand hover:text-white"
          : "border-line text-ink-soft hover:border-brand hover:text-brand"
      }`}
    >
      <svg aria-hidden viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
      {label}
    </button>
  );
}

function IconButton({
  children,
  label,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="grid h-9 w-9 place-items-center rounded-full border border-line text-ink-soft transition enabled:hover:border-brand enabled:hover:text-brand enabled:active:scale-95 disabled:opacity-35"
    >
      <svg aria-hidden viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </button>
  );
}
