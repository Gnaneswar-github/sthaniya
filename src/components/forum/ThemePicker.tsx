"use client";

import { FORUM_LIMITS, FORUM_THEMES } from "@/lib/forum";

/** Pick up to three topics, so a post shows up under the themes people browse by. */
export function ThemePicker({ value, onChange, legend = "Topics" }: { value: string[]; onChange: (next: string[]) => void; legend?: string }) {
  const full = value.length >= FORUM_LIMITS.themes;

  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold text-ink">
        {legend} <span className="font-normal text-ink-faint">— up to {FORUM_LIMITS.themes}, optional</span>
      </legend>
      <div className="flex flex-wrap gap-1.5">
        {FORUM_THEMES.map((theme) => {
          const on = value.includes(theme.slug);
          return (
            <button
              key={theme.slug}
              type="button"
              aria-pressed={on}
              disabled={!on && full}
              onClick={() => onChange(on ? value.filter((slug) => slug !== theme.slug) : [...value, theme.slug])}
              className={`rounded-full border px-3 py-1.5 text-[13px] transition disabled:opacity-40 ${
                on ? "border-brand bg-brand text-white" : "border-line bg-paper text-ink enabled:hover:border-brand"
              }`}
            >
              {theme.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
