"use client";

import Image from "next/image";
import { Amount } from "./currency/CurrencyControls";
import { clockLabel, durationLabel, placeLocalScore } from "@/lib/trip-engine";
import {
  CATEGORIES,
  LOCALITY_TAGS,
  PRICE_BANDS,
  type ItineraryItem,
  type LocalityTag,
} from "@/lib/types";

const TAG_STYLE: Record<LocalityTag, { pill: string; band: string }> = {
  tourist_essential: { pill: "bg-indigo/10 text-indigo", band: "from-indigo/85 to-indigo/45" },
  local_favourite: { pill: "bg-brand/10 text-brand", band: "from-brand/85 to-gold/50" },
  hidden_gem: { pill: "bg-moss/10 text-moss", band: "from-moss/85 to-moss/40" },
};

export function ItemCard({
  item,
  whyLine,
  onReplace,
  onRemove,
}: {
  item: ItineraryItem;
  whyLine: string;
  onReplace: () => void;
  onRemove: () => void;
}) {
  const { place } = item;
  const style = TAG_STYLE[place.tag];
  const price = PRICE_BANDS[place.priceBand];
  const end = item.startMinutes + item.durationMinutes;

  return (
    <article className="overflow-hidden rounded-2xl border border-line bg-paper-raised">
      <div className="flex">
        <div className="relative w-24 shrink-0 sm:w-32">
          {place.photo ? (
            <Image src={place.photo.url} alt={place.name} fill sizes="128px" className="object-cover" />
          ) : (
            <div className={`h-full bg-gradient-to-br ${style.band}`} aria-hidden />
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-2.5 p-4">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
            <span className="text-sm font-medium tabular-nums text-ink-soft">
              {clockLabel(item.startMinutes)} – {clockLabel(end)}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${style.pill}`}>
              {LOCALITY_TAGS[place.tag]}
            </span>
          </div>

          <div>
            <h4 className="font-display text-xl leading-tight text-ink">{place.name}</h4>
            <p className="text-sm text-ink-faint">{place.vibe}</p>
          </div>

          <p className="text-sm leading-relaxed text-ink-soft">{place.description}</p>

          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-faint">
            <span>{CATEGORIES[place.category]}</span>
            <span>·</span>
            <span>{durationLabel(item.durationMinutes)}</span>
            {/* Decide on the band, never on the amount: "unknown" also estimates zero, and
                testing the number labelled every unpriced place "Free". Unpriced places simply
                show no price line. */}
            {place.priceBand !== "unknown" && (
              <>
                <span>·</span>
                <span>
                  {place.priceBand === "free" ? (
                    "Free"
                  ) : (
                    <>
                      {price.label} ·{" "}
                      <Amount
                        money={{ amount: price.approx, currency: place.costCurrency ?? "USD" }}
                        showConversion
                      />
                    </>
                  )}
                </span>
              </>
            )}
            <span>·</span>
            <span>{placeLocalScore(place)} local</span>
          </div>

          <div className="rounded-lg bg-paper px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
              Why this fits you
            </p>
            <p className="mt-0.5 text-sm leading-relaxed text-ink">{whyLine}</p>
          </div>

          {item.offPreferredWindow && (
            <p className="text-xs italic text-gold">
              Scheduled outside its best window ({place.timeWindow.start}–{place.timeWindow.end}) —
              move it earlier if you can.
            </p>
          )}

          <div className="flex gap-2 pt-0.5">
            <button
              type="button"
              onClick={onReplace}
              className="rounded-lg border border-line px-3 py-1.5 text-xs text-ink-soft transition hover:border-brand hover:text-brand"
            >
              Replace
            </button>
            <button
              type="button"
              onClick={onRemove}
              className="rounded-lg border border-line px-3 py-1.5 text-xs text-ink-soft transition hover:border-brand hover:text-brand"
            >
              Remove
            </button>
          </div>
        </div>
      </div>

      {place.photo && (
        <p className="px-4 pb-2 text-right text-[10px] text-ink-faint">{place.photo.credit}</p>
      )}
    </article>
  );
}
