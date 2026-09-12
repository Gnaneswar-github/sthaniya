import { LOCALITY_TAGS, type ItineraryStop, type LocalityTag } from "@/lib/types";

const TAG_STYLE: Record<LocalityTag, { pill: string; band: string }> = {
  tourist_essential: {
    pill: "bg-indigo/10 text-indigo",
    band: "from-indigo/85 to-indigo/45",
  },
  local_favourite: {
    pill: "bg-terracotta/10 text-terracotta",
    band: "from-terracotta/85 to-saffron/50",
  },
  hidden_gem: {
    pill: "bg-moss/10 text-moss",
    band: "from-moss/85 to-moss/40",
  },
};

export function formatTime(value: string): string {
  const [h, m] = value.split(":").map(Number);
  const suffix = h < 12 ? "AM" : "PM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}

export function StopCard({ stop }: { stop: ItineraryStop }) {
  const style = TAG_STYLE[stop.tag];

  return (
    <article className="overflow-hidden rounded-2xl border border-line bg-paper-raised shadow-[0_1px_2px_rgba(36,31,27,0.04)]">
      {/* Placeholder visual — real photography still needs licensed sourcing. */}
      <div
        className={`flex h-28 items-end bg-gradient-to-br ${style.band} px-5 pb-3`}
        aria-hidden
      >
        <span className="font-display text-5xl leading-none text-paper-raised/90">
          {stop.name.charAt(0)}
        </span>
      </div>

      <div className="space-y-3 p-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="text-sm font-medium tabular-nums text-ink-soft">
            {formatTime(stop.timeWindow.start)} – {formatTime(stop.timeWindow.end)}
          </span>
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${style.pill}`}>
            {LOCALITY_TAGS[stop.tag]}
          </span>
        </div>

        <div>
          <h3 className="font-display text-2xl leading-tight text-ink">{stop.name}</h3>
          <p className="mt-1 text-sm text-ink-faint">{stop.vibe}</p>
        </div>

        <p className="text-[15px] leading-relaxed text-ink-soft">{stop.description}</p>

        <div className="rounded-xl bg-paper px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
            Why this fits you
          </p>
          <p className="mt-1 text-[15px] leading-relaxed text-ink">{stop.whyItFitsLine}</p>
        </div>

        {stop.skip && (
          <p className="text-sm italic text-ink-faint">
            Skip this one if you&rsquo;re short on time — the rest of the day matters more.
          </p>
        )}
      </div>
    </article>
  );
}
