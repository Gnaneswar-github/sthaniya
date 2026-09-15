"use client";

import { useId, useState, type FormEvent } from "react";
import { fieldClass, labelClass } from "../forms/styles";
import { CheckIcon } from "../icons";
import { DictationButton } from "../voice/DictationButton";
import { track } from "@/lib/analytics";
import { FORUM_LIMITS } from "@/lib/forum";
import { appendSpoken } from "@/lib/voice";

type Phase = "form" | "sending" | "sent" | "error";

/** Answer a published question. Replies appear once the team has reviewed them. */
export function ReplyForm({ questionId }: { questionId: string }) {
  const [body, setBody] = useState("");
  const [beenThere, setBeenThere] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [trap, setTrap] = useState("");
  const [phase, setPhase] = useState<Phase>("form");
  const [problem, setProblem] = useState<string | null>(null);
  const ids = { body: useId(), name: useId(), email: useId() };

  const ready = body.trim().length >= FORUM_LIMITS.replyMin && name.trim().length >= 1;

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
      const { error } = await supabase.from("forum_replies").insert({
        question_id: questionId,
        body: body.trim().slice(0, FORUM_LIMITS.reply),
        been_there: beenThere,
        author_name: name.trim().slice(0, FORUM_LIMITS.name),
        author_email: email.trim() || null,
      });
      if (error) throw new Error("We couldn't send your reply just now. Please try again in a moment.");
      track("forum_reply_sent", { been_there: beenThere });
      setPhase("sent");
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "Something went wrong. Please try again.");
      setPhase("error");
    }
  }

  if (phase === "sent") {
    return (
      <div className="flex items-start gap-3 rounded-3xl border border-line bg-paper-raised p-5">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand/10 text-brand">
          <CheckIcon className="h-5 w-5" />
        </span>
        <div>
          <p className="font-semibold text-ink">Thanks for answering</p>
          <p className="mt-0.5 text-sm text-ink-soft">Your reply appears here once our team has reviewed it.</p>
          <button
            type="button"
            onClick={() => {
              setBody("");
              setBeenThere(false);
              setPhase("form");
            }}
            className="mt-2 text-sm font-semibold text-brand hover:underline"
          >
            Add another reply
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5 rounded-3xl border border-line bg-paper-raised p-5 sm:p-6">
      <div className="grid gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor={ids.body} className="font-display text-2xl text-ink">
            Your answer
          </label>
          <DictationButton label="Speak your answer" onText={(spoken) => setBody((current) => appendSpoken(current, spoken).slice(0, FORUM_LIMITS.reply))} />
        </div>
        <textarea
          id={ids.body}
          required
          rows={5}
          minLength={FORUM_LIMITS.replyMin}
          maxLength={FORUM_LIMITS.reply}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="What you'd tell a friend — what worked, what you'd skip, what to book ahead."
          className={`${fieldClass} resize-y leading-relaxed`}
        />
      </div>

      <label className="flex items-center gap-3 text-sm text-ink">
        <input type="checkbox" checked={beenThere} onChange={(event) => setBeenThere(event.target.checked)} className="h-4 w-4 accent-[var(--brand)]" />
        I&rsquo;ve been there myself
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor={ids.name} className={labelClass}>
              Name to show
            </label>
            <DictationButton label="Speak your name" onText={(spoken) => setName((current) => appendSpoken(current, spoken).slice(0, FORUM_LIMITS.name))} />
          </div>
          <input id={ids.name} required maxLength={FORUM_LIMITS.name} value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" className={fieldClass} />
        </div>
        <div className="grid gap-1.5">
          <div className="flex h-10 items-center">
            <label htmlFor={ids.email} className={labelClass}>
              Email <span className="font-normal text-ink-faint">— private, optional</span>
            </label>
          </div>
          <input id={ids.email} type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" className={fieldClass} />
        </div>
      </div>

      <input tabIndex={-1} aria-hidden autoComplete="off" name="website" value={trap} onChange={(event) => setTrap(event.target.value)} className="absolute -left-[9999px] h-px w-px opacity-0" />

      {problem && (
        <p role="alert" className="rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">
          {problem}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={!ready || phase === "sending"}
          className="rounded-full bg-brand px-6 py-3 text-[15px] font-semibold text-white transition enabled:hover:bg-brand-deep disabled:opacity-55"
        >
          {phase === "sending" ? "Sending…" : "Post reply"}
        </button>
        <p className="text-xs text-ink-faint">Reviewed before it appears. Your email is never shown.</p>
      </div>
    </form>
  );
}
