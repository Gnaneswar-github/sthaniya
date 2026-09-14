"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../AuthProvider";
import { FeelingFace } from "./Faces";
import { supabase } from "@/lib/supabase";

type Row = {
  id: string;
  created_at: string;
  feeling: number | null;
  topic: "idea" | "bug" | "love" | "other";
  message: string;
  email: string | null;
  page: string | null;
  user_agent: string | null;
  status: "new" | "done";
};

type Filter = "all" | "idea" | "bug" | "love" | "new";

const TOPIC_LABEL: Record<Row["topic"], string> = { idea: "Idea", bug: "Something broke", love: "Loved it", other: "Other" };
const TOPIC_STYLE: Record<Row["topic"], string> = {
  idea: "bg-gold/10 text-gold",
  bug: "bg-danger/10 text-danger",
  love: "bg-brand/10 text-brand-deep",
  other: "bg-paper-sunken text-ink-soft",
};

function browserOf(ua: string | null) {
  if (!ua) return "";
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /iPhone|iPad/.test(ua) ? "iPhone" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "Mac" : "";
  return os ? `${browser} on ${os}` : browser;
}

function ago(iso: string) {
  const minutes = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (minutes < 60) return `${Math.max(1, minutes)} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/** The admin's inbox. Row-level security returns nothing to anyone who isn't on the admin list. */
export function FeedbackInbox() {
  const { user, ready, available } = useAuth();
  const [admin, setAdmin] = useState<boolean | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !supabase) return;
    let live = true;
    const client = supabase;
    client.rpc("is_app_admin").then(({ data, error: rpcError }) => {
      if (!live) return;
      if (rpcError) {
        setError("Couldn't check your access.");
        return;
      }
      setAdmin(Boolean(data));
      if (!data) return;
      client
        .from("feedback")
        .select("id, created_at, feeling, topic, message, email, page, user_agent, status")
        .order("created_at", { ascending: false })
        .limit(500)
        .then(({ data: list, error: listError }) => {
          if (!live) return;
          if (listError) setError("Couldn't load feedback.");
          else setRows((list ?? []) as Row[]);
        });
    });
    return () => {
      live = false;
    };
  }, [user]);

  const stats = useMemo(() => {
    const list = rows ?? [];
    const rated = list.filter((row) => row.feeling);
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    return {
      total: list.length,
      average: rated.length ? (rated.reduce((sum, row) => sum + (row.feeling ?? 0), 0) / rated.length).toFixed(1) : "—",
      ideas: list.filter((row) => row.topic === "idea" && Date.parse(row.created_at) >= monthStart.getTime()).length,
      fresh: list.filter((row) => row.status === "new").length,
    };
  }, [rows]);

  if (!available) return <p className="text-ink-soft">Accounts aren&rsquo;t switched on for this deployment yet.</p>;
  if (!ready) return <p className="text-ink-faint">Checking your session…</p>;
  if (!user) {
    return (
      <div className="rounded-3xl border border-line bg-paper-raised p-8 text-center">
        <h2 className="font-display text-2xl text-ink">Sign in to open the inbox</h2>
        <Link href="/account?next=/admin/feedback" className="mt-5 inline-block rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-deep">
          Sign in
        </Link>
      </div>
    );
  }
  if (error) return <p className="rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>;
  if (admin === false) return <p className="rounded-2xl bg-paper-sunken px-4 py-3 text-sm text-ink-soft">This inbox is only for the site admin.</p>;
  if (admin === null || rows === null) return <p className="text-ink-faint">Loading feedback…</p>;

  const shown = rows.filter((row) => (filter === "all" ? true : filter === "new" ? row.status === "new" : row.topic === filter));

  async function toggle(row: Row) {
    if (!supabase) return;
    const next = row.status === "new" ? "done" : "new";
    setRows((current) => (current ?? []).map((r) => (r.id === row.id ? { ...r, status: next } : r)));
    const { error: updateError } = await supabase.from("feedback").update({ status: next }).eq("id", row.id);
    if (updateError) setRows((current) => (current ?? []).map((r) => (r.id === row.id ? { ...r, status: row.status } : r)));
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-line bg-paper-raised">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
        <h2 className="font-display text-2xl text-ink">Feedback inbox</h2>
        <dl className="flex flex-wrap gap-5 text-[13px] text-ink-soft">
          <div className="flex items-baseline gap-1.5"><dd className="font-display text-xl text-ink">{stats.total}</dd><dt>notes</dt></div>
          <div className="flex items-baseline gap-1.5"><dd className="font-display text-xl text-ink">{stats.average}</dd><dt>average feeling</dt></div>
          <div className="flex items-baseline gap-1.5"><dd className="font-display text-xl text-ink">{stats.ideas}</dd><dt>ideas this month</dt></div>
        </dl>
      </div>

      <div className="flex flex-wrap gap-1.5 border-b border-line px-5 py-3 sm:px-6">
        {(
          [
            ["all", "All"],
            ["idea", "Ideas"],
            ["bug", "Something broke"],
            ["love", "Loved"],
            ["new", `New (${stats.fresh})`],
          ] as [Filter, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={filter === id}
            onClick={() => setFilter(id)}
            className={`rounded-full border px-3 py-1.5 text-[13px] transition ${filter === id ? "border-brand bg-brand text-white" : "border-line bg-paper text-ink hover:border-brand"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="px-6 py-10 text-center text-sm text-ink-faint">{rows.length === 0 ? "No feedback yet. It will appear here the moment someone sends a note." : "Nothing in this view."}</p>
      ) : (
        <ul className="divide-y divide-line">
          {shown.map((row) => (
            <li key={row.id} className={`grid grid-cols-[2.5rem_1fr] gap-3 px-5 py-4 sm:grid-cols-[2.5rem_1fr_auto] sm:px-6 ${row.status === "done" ? "opacity-60" : ""}`}>
              <span className={`grid h-9 w-9 place-items-center rounded-xl bg-paper ${row.feeling && row.feeling <= 2 ? "text-danger" : "text-brand"}`}>
                {row.feeling ? <FeelingFace value={row.feeling} className="h-[22px] w-[22px]" /> : <span className="text-xs text-ink-faint">–</span>}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-faint">
                  <span className={`rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${TOPIC_STYLE[row.topic]}`}>{TOPIC_LABEL[row.topic]}</span>
                  <span>{row.page ?? "/"}</span>
                  <span aria-hidden>·</span>
                  <span>{ago(row.created_at)}</span>
                  {row.user_agent && (
                    <>
                      <span aria-hidden>·</span>
                      <span>{browserOf(row.user_agent)}</span>
                    </>
                  )}
                  {row.email && (
                    <>
                      <span aria-hidden>·</span>
                      <a href={`mailto:${row.email}`} className="text-brand underline">
                        {row.email}
                      </a>
                    </>
                  )}
                </div>
                <p className="mt-1 whitespace-pre-wrap break-words text-[15px] text-ink">{row.message}</p>
              </div>
              <button
                type="button"
                onClick={() => toggle(row)}
                className="col-start-2 justify-self-start rounded-full border border-line px-3 py-1.5 text-xs text-ink-soft transition hover:border-brand hover:text-brand sm:col-start-auto sm:self-start"
              >
                {row.status === "new" ? "Mark as done" : "Mark as new"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
