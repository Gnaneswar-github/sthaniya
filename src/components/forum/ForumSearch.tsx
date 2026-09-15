"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { DictationButton } from "../voice/DictationButton";
import { appendSpoken } from "@/lib/voice";

/** Search questions and stories. A plain GET form underneath, so it works before the page hydrates. */
export function ForumSearch({ defaultValue = "" }: { defaultValue?: string }) {
  const router = useRouter();
  const inputId = useId();
  const [q, setQ] = useState(defaultValue);

  return (
    <form
      action="/forum/search"
      method="get"
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        const term = q.trim();
        if (term) router.push(`/forum/search?q=${encodeURIComponent(term)}`);
      }}
      className="flex w-full flex-col gap-2 sm:flex-row"
    >
      <label htmlFor={inputId} className="sr-only">
        Search the forum
      </label>
      <div className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl border border-line-strong bg-paper-raised pl-4 pr-1.5 transition focus-within:border-brand">
        <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-ink-soft" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          id={inputId}
          name="q"
          value={q}
          maxLength={80}
          onChange={(event) => setQ(event.target.value)}
          placeholder="Rail pass or single tickets in Japan?"
          className="min-w-0 flex-1 bg-transparent py-3.5 text-[15px] text-ink outline-none placeholder:text-ink-faint"
        />
        <DictationButton label="Search by voice" onText={(spoken) => setQ((current) => appendSpoken(current, spoken).slice(0, 80))} />
      </div>
      <button type="submit" className="shrink-0 rounded-2xl bg-deep px-6 py-3.5 text-[15px] font-semibold text-white transition hover:bg-brand-deep">
        Search forum
      </button>
    </form>
  );
}
