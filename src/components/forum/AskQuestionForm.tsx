"use client";

import Link from "next/link";
import { useId, useState, type FormEvent } from "react";
import { fieldClass, labelClass } from "../forms/styles";
import { CheckIcon } from "../icons";
import { DictationButton } from "../voice/DictationButton";
import { ThemePicker } from "./ThemePicker";
import { track } from "@/lib/analytics";
import { FORUM_LIMITS, FORUM_REGIONS } from "@/lib/forum";
import { appendSpoken } from "@/lib/voice";

type Phase = "form" | "sending" | "sent" | "error";

/** Ask the forum a question. Every text box can be spoken; nothing is public until reviewed. */
export function AskQuestionForm({
  initialTitle = "",
  initialRegion = "",
  initialTheme = "",
  initialPlace = "",
}: {
  initialTitle?: string;
  initialRegion?: string;
  initialTheme?: string;
  initialPlace?: string;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [details, setDetails] = useState("");
  const [region, setRegion] = useState(initialRegion);
  const [place, setPlace] = useState(initialPlace);
  const [themes, setThemes] = useState<string[]>(initialTheme ? [initialTheme] : []);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [trap, setTrap] = useState("");
  const [phase, setPhase] = useState<Phase>("form");
  const [problem, setProblem] = useState<string | null>(null);
  const ids = { title: useId(), details: useId(), region: useId(), place: useId(), name: useId(), email: useId() };

  const titleShort = title.trim().length < FORUM_LIMITS.titleMin;
  const ready = !titleShort && region !== "" && name.trim().length >= 1;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!ready || phase === "sending") return;
    if (trap) {
      setPhase("sent");
      return;
    }
    setPhase("sending");
    setProblem(null);
    try {
      const { supabase } = await import("@/lib/supabase");
      if (!supabase) throw new Error("The forum isn't switched on for this site yet.");
      const { error } = await supabase.from("forum_questions").insert({
        region,
        themes,
        place: place.trim().length >= 2 ? place.trim().slice(0, FORUM_LIMITS.place) : null,
        title: title.trim().slice(0, FORUM_LIMITS.title),
        body: details.trim().slice(0, FORUM_LIMITS.details),
        author_name: name.trim().slice(0, FORUM_LIMITS.name),
        author_email: email.trim() || null,
      });
      if (error) throw new Error("We couldn't post your question just now. Please try again in a moment.");
      track("forum_question_sent", { region, themes: themes.length });
      setPhase("sent");
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "Something went wrong. Please try again.");
      setPhase("error");
    }
  }

  if (phase === "sent") {
    return (
      <div className="grid justify-items-center gap-3 rounded-3xl border border-line bg-paper-raised px-6 py-10 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-brand/10 text-brand">
          <CheckIcon className="h-7 w-7" />
        </span>
        <h2 className="font-display text-3xl text-ink">Question sent</h2>
        <p className="max-w-md text-[15px] leading-relaxed text-ink-soft">
          Our team will read it shortly. Once it&rsquo;s approved it appears in the forum, where travellers who&rsquo;ve been can answer.
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <Link href="/forum" className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-deep">
            Browse the forum
          </Link>
          <button
            type="button"
            onClick={() => {
              setTitle("");
              setDetails("");
              setPlace("");
              setThemes([]);
              setPhase("form");
            }}
            className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold text-ink-soft transition hover:border-brand hover:text-brand"
          >
            Ask another
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-6 rounded-3xl border border-line bg-paper-raised p-5 sm:p-7">
      <p className="rounded-2xl bg-paper px-4 py-3 text-sm text-ink-soft">
        Prefer talking? Tap the <span className="font-semibold text-ink">microphone</span> next to any box and say it — we&rsquo;ll write it down.
      </p>

      <div className="grid gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor={ids.title} className={labelClass}>
            Your question
          </label>
          <DictationButton label="Speak your question" onText={(spoken) => setTitle((current) => appendSpoken(current, spoken).slice(0, FORUM_LIMITS.title))} />
        </div>
        <input
          id={ids.title}
          required
          minLength={FORUM_LIMITS.titleMin}
          maxLength={FORUM_LIMITS.title}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Is a rail pass worth it for five days around Japan?"
          className={fieldClass}
        />
        <p className="text-xs text-ink-faint">One clear question gets the best answers.</p>
      </div>

      <div className="grid gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor={ids.details} className={labelClass}>
            Details <span className="font-normal text-ink-faint">— optional</span>
          </label>
          <DictationButton label="Speak the details" onText={(spoken) => setDetails((current) => appendSpoken(current, spoken).slice(0, FORUM_LIMITS.details))} />
        </div>
        <textarea
          id={ids.details}
          rows={5}
          maxLength={FORUM_LIMITS.details}
          value={details}
          onChange={(event) => setDetails(event.target.value)}
          placeholder="When you're going, who with, what you've already looked at."
          className={`${fieldClass} resize-y leading-relaxed`}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <div className="flex h-10 items-center">
            <label htmlFor={ids.region} className={labelClass}>
              Where in the world?
            </label>
          </div>
          <select id={ids.region} required value={region} onChange={(event) => setRegion(event.target.value)} className={fieldClass}>
            <option value="" disabled>
              Choose a region
            </option>
            {FORUM_REGIONS.map((option) => (
              <option key={option.slug} value={option.slug}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor={ids.place} className={labelClass}>
              Place <span className="font-normal text-ink-faint">— optional</span>
            </label>
            <DictationButton label="Speak the place" onText={(spoken) => setPlace((current) => appendSpoken(current, spoken).slice(0, FORUM_LIMITS.place))} />
          </div>
          <input
            id={ids.place}
            maxLength={FORUM_LIMITS.place}
            value={place}
            onChange={(event) => setPlace(event.target.value)}
            placeholder="City, island or area"
            className={fieldClass}
          />
        </div>
      </div>

      <ThemePicker value={themes} onChange={setThemes} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor={ids.name} className={labelClass}>
              Name to show
            </label>
            <DictationButton label="Speak your name" onText={(spoken) => setName((current) => appendSpoken(current, spoken).slice(0, FORUM_LIMITS.name))} />
          </div>
          <input id={ids.name} required maxLength={FORUM_LIMITS.name} value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" placeholder="Alex M." className={fieldClass} />
        </div>
        <div className="grid gap-1.5">
          <div className="flex h-10 items-center">
            <label htmlFor={ids.email} className={labelClass}>
              Email <span className="font-normal text-ink-faint">— private, optional</span>
            </label>
          </div>
          <input id={ids.email} type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="Only if we may contact you" className={fieldClass} />
        </div>
      </div>

      <input tabIndex={-1} aria-hidden autoComplete="off" name="website" value={trap} onChange={(event) => setTrap(event.target.value)} className="absolute -left-[9999px] h-px w-px opacity-0" />

      {problem && (
        <p role="alert" className="rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">
          {problem}
        </p>
      )}

      <div className="space-y-2">
        <button
          type="submit"
          disabled={!ready || phase === "sending"}
          className="w-full rounded-full bg-brand py-3.5 text-[15px] font-semibold text-white transition enabled:hover:bg-brand-deep disabled:opacity-55"
        >
          {phase === "sending" ? "Sending…" : "Post for review"}
        </button>
        <p className="text-center text-xs text-ink-faint">Your email is never shown. Nothing is public until our team has reviewed it.</p>
      </div>
    </form>
  );
}
