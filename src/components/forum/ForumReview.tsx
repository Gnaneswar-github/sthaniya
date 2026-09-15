"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "../AuthProvider";
import { forumDate, regionLabel, themeLabel } from "@/lib/forum";
import { supabase } from "@/lib/supabase";

type Status = "pending" | "approved" | "declined";
type Kind = "questions" | "replies";

type QuestionRow = {
  id: string;
  created_at: string;
  status: Status;
  region: string;
  themes: string[];
  place: string | null;
  title: string;
  body: string;
  author_name: string;
  author_email: string | null;
  decline_reason: string | null;
};

type ReplyRow = {
  id: string;
  created_at: string;
  status: Status;
  question_id: string;
  body: string;
  been_there: boolean;
  author_name: string;
  author_email: string | null;
  decline_reason: string | null;
  question: { title: string; status: Status } | null;
};

const STATUSES: { id: Status; label: string }[] = [
  { id: "pending", label: "Waiting" },
  { id: "approved", label: "Approved" },
  { id: "declined", label: "Declined" },
];

const TABLE: Record<Kind, string> = { questions: "forum_questions", replies: "forum_replies" };

/** The admin's forum queue: questions and replies, each approved or declined. Row-level security limits it to the admin. */
export function ForumReview() {
  const { user, ready, available } = useAuth();
  const [admin, setAdmin] = useState<boolean | null>(null);
  const [questions, setQuestions] = useState<QuestionRow[] | null>(null);
  const [replies, setReplies] = useState<ReplyRow[] | null>(null);
  const [kind, setKind] = useState<Kind>("questions");
  const [tab, setTab] = useState<Status>("pending");
  const [declining, setDeclining] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !supabase) return;
    const client = supabase;
    let live = true;
    client.rpc("is_app_admin").then(async ({ data: isAdmin, error: rpcError }) => {
      if (!live) return;
      if (rpcError) {
        setError("Couldn't check your access.");
        return;
      }
      setAdmin(Boolean(isAdmin));
      if (!isAdmin) return;
      const [q, r] = await Promise.all([
        client
          .from("forum_questions")
          .select("id, created_at, status, region, themes, place, title, body, author_name, author_email, decline_reason")
          .order("created_at", { ascending: false })
          .limit(500),
        client
          .from("forum_replies")
          .select("id, created_at, status, question_id, body, been_there, author_name, author_email, decline_reason, question:forum_questions(title, status)")
          .order("created_at", { ascending: false })
          .limit(500),
      ]);
      if (!live) return;
      if (q.error || r.error) {
        setError("Couldn't load the forum queue.");
        return;
      }
      setQuestions((q.data ?? []) as QuestionRow[]);
      setReplies((r.data ?? []) as unknown as ReplyRow[]);
    });
    return () => {
      live = false;
    };
  }, [user]);

  if (!available) return <p className="text-ink-soft">Accounts aren&rsquo;t switched on for this deployment yet.</p>;
  if (!ready) return <p className="text-ink-faint">Checking your session…</p>;
  if (!user) {
    return (
      <div className="rounded-3xl border border-line bg-paper-raised p-8 text-center">
        <h2 className="font-display text-2xl text-ink">Sign in to review the forum</h2>
        <Link href="/account?next=/admin/forum" className="mt-5 inline-block rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-deep">
          Sign in
        </Link>
      </div>
    );
  }
  if (error) return <p className="rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>;
  if (admin === false) return <p className="rounded-2xl bg-paper-sunken px-4 py-3 text-sm text-ink-soft">This review queue is only for the site admin.</p>;
  if (admin === null || questions === null || replies === null) return <p className="text-ink-faint">Loading the forum queue…</p>;

  async function decide(target: Kind, id: string, status: Status, declineReason: string | null = null) {
    if (!supabase) return;
    setBusy(id);
    const change = { status, reviewed_at: status === "pending" ? null : new Date().toISOString(), decline_reason: status === "declined" ? declineReason : null };
    const { error: updateError } = await supabase.from(TABLE[target]).update(change).eq("id", id);
    setBusy(null);
    if (updateError) {
      setError("That change didn't save. Please try again.");
      return;
    }
    if (target === "questions") setQuestions((rows) => (rows ?? []).map((row) => (row.id === id ? { ...row, ...change } : row)));
    else setReplies((rows) => (rows ?? []).map((row) => (row.id === id ? { ...row, ...change } : row)));
    setDeclining(null);
    setReason("");
  }

  const rows: (QuestionRow | ReplyRow)[] = kind === "questions" ? questions : replies;
  const waiting = { questions: questions.filter((row) => row.status === "pending").length, replies: replies.filter((row) => row.status === "pending").length };
  const counts = Object.fromEntries(STATUSES.map((s) => [s.id, rows.filter((row) => row.status === s.id).length])) as Record<Status, number>;
  const shown = rows.filter((row) => row.status === tab);

  function actions(target: Kind, id: string, status: Status, extra?: React.ReactNode) {
    return (
      <div className="grid content-start gap-2">
        {status !== "approved" && (
          <button
            type="button"
            disabled={busy === id}
            onClick={() => decide(target, id, "approved")}
            className="rounded-full bg-brand px-4 py-2.5 text-sm font-semibold text-white transition enabled:hover:bg-brand-deep disabled:opacity-60"
          >
            {status === "declined" ? "Approve after all" : "Approve & publish"}
          </button>
        )}
        {status !== "declined" &&
          (declining === id ? (
            <div className="grid gap-2">
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value.slice(0, 300))}
                rows={3}
                placeholder="Private reason, e.g. advertising"
                className="rounded-xl border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-brand"
              />
              <button
                type="button"
                disabled={busy === id}
                onClick={() => decide(target, id, "declined", reason.trim() || null)}
                className="rounded-full border border-danger/40 bg-paper-raised px-4 py-2 text-sm font-semibold text-danger transition hover:bg-danger/10"
              >
                Confirm decline
              </button>
              <button type="button" onClick={() => setDeclining(null)} className="text-xs text-ink-faint hover:text-ink">
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setDeclining(id);
                setReason("");
              }}
              className="rounded-full border border-line bg-paper-raised px-4 py-2.5 text-sm font-semibold text-danger transition hover:border-danger/50"
            >
              {status === "approved" ? "Unpublish" : "Decline"}
            </button>
          ))}
        {status !== "pending" && (
          <button type="button" disabled={busy === id} onClick={() => decide(target, id, "pending")} className="text-xs text-ink-faint hover:text-ink">
            Move back to waiting
          </button>
        )}
        {extra}
      </div>
    );
  }

  const contact = (name: string, email: string | null) => (
    <p className="mt-3 text-xs text-ink-faint">
      By {name}
      {email && (
        <>
          {" · "}
          <a href={`mailto:${email}`} className="text-brand underline">
            {email}
          </a>
        </>
      )}
    </p>
  );

  return (
    <div className="overflow-hidden rounded-3xl border border-line bg-paper-raised">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
        <div className="flex gap-1 rounded-full bg-paper-sunken p-1 text-sm font-semibold">
          {(["questions", "replies"] as Kind[]).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={kind === option}
              onClick={() => {
                setKind(option);
                setDeclining(null);
              }}
              className={`rounded-full px-4 py-2 capitalize transition ${kind === option ? "bg-paper-raised text-ink shadow-sm" : "text-ink-soft hover:text-ink"}`}
            >
              {option}
              {waiting[option] > 0 && <span className="ml-1.5 rounded-full bg-gold-bright px-1.5 text-xs tabular-nums text-deep">{waiting[option]}</span>}
            </button>
          ))}
        </div>
        <p className="text-[13px] text-ink-soft">Approved posts appear on the site within a few minutes.</p>
      </div>

      <div className="flex flex-wrap gap-1.5 border-b border-line px-5 py-3 sm:px-6">
        {STATUSES.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-pressed={tab === s.id}
            onClick={() => setTab(s.id)}
            className={`rounded-full border px-3 py-1.5 text-[13px] transition ${tab === s.id ? "border-brand bg-brand text-white" : "border-line bg-paper text-ink hover:border-brand"}`}
          >
            {s.label} <span className="font-semibold tabular-nums">{counts[s.id]}</span>
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="px-6 py-10 text-center text-sm text-ink-faint">{tab === "pending" ? "Nothing waiting. New posts appear here as soon as they're sent." : "Nothing here yet."}</p>
      ) : (
        <ul className="divide-y divide-line">
          {kind === "questions"
            ? (shown as QuestionRow[]).map((row) => (
                <li key={row.id} className="grid gap-5 px-5 py-5 sm:px-6 lg:grid-cols-[1fr_12rem]">
                  <div className="min-w-0">
                    <p className="text-xs text-ink-faint">
                      {[row.place, regionLabel(row.region)].filter(Boolean).join(" · ")} · sent {forumDate(row.created_at)}
                    </p>
                    <h3 className="mt-1 text-lg font-semibold leading-snug text-ink">{row.title}</h3>
                    {row.body && <p className="mt-2 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-ink">{row.body}</p>}
                    {row.themes.length > 0 && <p className="mt-2 text-xs text-ink-soft">Topics: {row.themes.map((slug) => themeLabel(slug)).join(", ")}</p>}
                    {/https?:\/\/|www\./i.test(`${row.title} ${row.body}`) && <p className="mt-3 rounded-xl bg-gold/10 px-3 py-2 text-xs text-gold">Contains a link — check it before approving.</p>}
                    {contact(row.author_name, row.author_email)}
                    {row.status === "declined" && row.decline_reason && <p className="mt-2 text-xs text-danger">Declined: {row.decline_reason}</p>}
                  </div>
                  {actions(
                    "questions",
                    row.id,
                    row.status,
                    row.status === "approved" && (
                      <Link href={`/forum/questions/${row.id}`} className="text-center text-xs font-semibold text-brand hover:underline">
                        View on site
                      </Link>
                    ),
                  )}
                </li>
              ))
            : (shown as ReplyRow[]).map((row) => (
                <li key={row.id} className="grid gap-5 px-5 py-5 sm:px-6 lg:grid-cols-[1fr_12rem]">
                  <div className="min-w-0">
                    <p className="text-xs text-ink-faint">
                      Reply to{" "}
                      <span className="font-semibold text-ink-soft">{row.question?.title ?? "a question"}</span>
                      {row.question && row.question.status !== "approved" && " (question not published)"} · sent {forumDate(row.created_at)}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-ink">{row.body}</p>
                    {row.been_there && <p className="mt-2 text-xs font-semibold text-brand-deep">Says they&rsquo;ve been there</p>}
                    {/https?:\/\/|www\./i.test(row.body) && <p className="mt-3 rounded-xl bg-gold/10 px-3 py-2 text-xs text-gold">Contains a link — check it before approving.</p>}
                    {contact(row.author_name, row.author_email)}
                    {row.status === "declined" && row.decline_reason && <p className="mt-2 text-xs text-danger">Declined: {row.decline_reason}</p>}
                  </div>
                  {actions(
                    "replies",
                    row.id,
                    row.status,
                    <Link href={`/forum/questions/${row.question_id}`} className="text-center text-xs font-semibold text-brand hover:underline">
                      Open the question
                    </Link>,
                  )}
                </li>
              ))}
        </ul>
      )}
    </div>
  );
}
