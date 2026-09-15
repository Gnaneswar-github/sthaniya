"use client";

import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { CheckIcon, CloseIcon } from "../icons";
import { DictationButton } from "../voice/DictationButton";
import { FEELINGS, FeelingFace } from "./Faces";
import { appendSpoken } from "@/lib/voice";
import { track } from "@/lib/analytics";
import { supabase } from "@/lib/supabase";

const TOPICS = [
  { id: "idea", label: "An idea" },
  { id: "bug", label: "Something broke" },
  { id: "love", label: "Something I loved" },
  { id: "other", label: "Other" },
] as const;

type Topic = (typeof TOPICS)[number]["id"];
type Phase = "form" | "sending" | "sent" | "error";

const MAX = 1000;

/**
 * A "Feedback" button in the corner of every page, opening a short form. Notes go to a table only
 * the site admin can read; nothing else about the visitor is collected beyond the page they were
 * on and their browser.
 */
export function FeedbackWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("form");
  const [feeling, setFeeling] = useState<number | null>(null);
  const [topic, setTopic] = useState<Topic>("idea");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [trap, setTrap] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const messageId = useId();

  // Escape closes, and focus returns to the button that opened it.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    panelRef.current?.querySelector<HTMLElement>("button, textarea")?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (pathname?.startsWith("/admin")) return null;

  function reset() {
    setPhase("form");
    setFeeling(null);
    setTopic("idea");
    setMessage("");
    setEmail("");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (message.trim().length < 3) return;
    // A hidden field only bots fill in: accept quietly and send nothing.
    if (trap) {
      setPhase("sent");
      return;
    }
    if (!supabase) {
      setPhase("error");
      return;
    }
    setPhase("sending");
    const { error } = await supabase.from("feedback").insert({
      feeling,
      topic,
      message: message.trim().slice(0, MAX),
      email: email.trim() || null,
      page: (pathname || "/").slice(0, 300),
      user_agent: navigator.userAgent.slice(0, 400),
    });
    if (error) {
      setPhase("error");
      return;
    }
    track("feedback_sent", { topic, feeling: feeling ?? 0 });
    setPhase("sent");
  }

  return (
    <div className="no-print">
      {!open && (
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-4 right-4 z-40 inline-flex items-center gap-2 rounded-full bg-deep px-4 py-3 text-sm font-semibold text-white shadow-[0_18px_36px_-18px_rgba(7,28,41,0.8)] ring-1 ring-white/15 transition hover:-translate-y-0.5 hover:bg-deep-2 sm:bottom-5 sm:right-5"
        >
          <svg aria-hidden viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-6l-4 3.5V17H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
            <path d="M8 10h8M8 13h5" />
          </svg>
          Feedback
        </button>
      )}

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-labelledby={titleId}
          className="fixed inset-x-3 bottom-3 z-50 max-h-[calc(100svh-1.5rem)] overflow-y-auto rounded-3xl border border-line bg-paper-raised shadow-[0_30px_70px_-30px_rgba(13,47,66,0.55)] sm:inset-x-auto sm:bottom-5 sm:right-5 sm:w-[380px]"
        >
          {phase === "sent" ? (
            <div className="grid justify-items-center gap-2.5 px-6 pb-7 pt-8 text-center">
              <span className="grid h-14 w-14 place-items-center rounded-full bg-brand/10 text-brand">
                <CheckIcon className="h-7 w-7" />
              </span>
              <h2 id={titleId} className="font-display text-2xl text-ink">
                Thank you
              </h2>
              <p className="max-w-[30ch] text-[15px] text-ink-soft">Every note is read. Ideas that come up often go straight onto the list.</p>
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={reset} className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-ink-soft transition hover:border-brand hover:text-brand">
                  Send another
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    reset();
                  }}
                  className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-deep"
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={submit}>
              <div className="flex items-start justify-between gap-3 px-5 pb-1 pt-5">
                <div>
                  <h2 id={titleId} className="font-display text-[22px] leading-tight text-ink">
                    Help shape Nativa
                  </h2>
                  <p className="mt-1 text-[13px] text-ink-soft">Two minutes, and it goes straight to the person building it.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close feedback"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-faint transition hover:bg-paper-sunken hover:text-ink"
                >
                  <CloseIcon className="h-4 w-4" />
                </button>
              </div>

              <div className="grid gap-4 px-5 pb-5 pt-3">
                <fieldset>
                  <legend className="mb-2 text-sm font-semibold text-ink">How&rsquo;s Nativa so far?</legend>
                  <div className="grid grid-cols-5 gap-1.5">
                    {FEELINGS.map((option) => {
                      const on = feeling === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          aria-pressed={on}
                          onClick={() => setFeeling(on ? null : option.value)}
                          className={`grid justify-items-center gap-1 rounded-2xl border px-0.5 py-2 text-[11px] transition ${
                            on ? "border-brand bg-brand/10 font-semibold text-brand-deep" : "border-line bg-paper text-ink-soft hover:border-brand/50"
                          }`}
                        >
                          <FeelingFace value={option.value} />
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="mb-2 text-sm font-semibold text-ink">What&rsquo;s it about?</legend>
                  <div className="flex flex-wrap gap-1.5">
                    {TOPICS.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        aria-pressed={topic === option.id}
                        onClick={() => setTopic(option.id)}
                        className={`rounded-full border px-3 py-1.5 text-[13px] transition ${
                          topic === option.id ? "border-brand bg-brand text-white" : "border-line bg-paper text-ink hover:border-brand"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <div className="grid gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <label htmlFor={messageId} className="text-sm font-semibold text-ink">
                      Tell us more
                    </label>
                    <DictationButton
                      label="Speak your feedback"
                      onText={(spoken) => setMessage((current) => appendSpoken(current, spoken).slice(0, MAX))}
                    />
                  </div>
                  <textarea
                    id={messageId}
                    required
                    minLength={3}
                    maxLength={MAX}
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    rows={4}
                    placeholder="What would make Nativa better for you?"
                    className="resize-none rounded-2xl border border-line bg-paper px-3 py-2.5 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-brand focus:bg-paper-raised"
                  />
                  <span className="text-right text-xs tabular-nums text-ink-faint">
                    {message.length} / {MAX}
                  </span>
                </div>

                <label className="grid gap-1.5">
                  <span className="text-sm font-semibold text-ink">
                    Email <span className="font-normal text-ink-faint">— optional, only if you&rsquo;d like a reply</span>
                  </span>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    placeholder="you@example.com"
                    className="rounded-2xl border border-line bg-paper px-3 py-2.5 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-brand focus:bg-paper-raised"
                  />
                </label>

                <input
                  tabIndex={-1}
                  aria-hidden
                  autoComplete="off"
                  value={trap}
                  onChange={(event) => setTrap(event.target.value)}
                  name="website"
                  className="absolute -left-[9999px] h-px w-px opacity-0"
                />

                {phase === "error" && (
                  <p role="alert" className="rounded-2xl bg-danger/10 px-3 py-2.5 text-sm text-danger">
                    We couldn&rsquo;t send that just now. Please try again in a moment.
                  </p>
                )}

                <button
                  type="submit"
                  disabled={phase === "sending" || message.trim().length < 3}
                  className="w-full rounded-full bg-brand py-3 text-[15px] font-semibold text-white transition enabled:hover:bg-brand-deep disabled:opacity-55"
                >
                  {phase === "sending" ? "Sending…" : "Send feedback"}
                </button>
                <p className="-mt-1 text-center text-[11.5px] text-ink-faint">We save your note, the page you were on and your browser type. Nothing else.</p>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
