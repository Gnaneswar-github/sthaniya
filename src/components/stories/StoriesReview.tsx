"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "../AuthProvider";
import { STORY_BUCKET, placeKindLabel, type StoryPlace } from "@/lib/stories";
import { supabase } from "@/lib/supabase";

type Status = "pending" | "approved" | "declined";

type Row = {
  id: string;
  created_at: string;
  status: Status;
  realm: "earth" | "beyond";
  place: string;
  travelled_on: string | null;
  title: string;
  body: string;
  places: StoryPlace[];
  photos: string[];
  author_name: string;
  author_email: string | null;
  decline_reason: string | null;
  reviewed_at: string | null;
};

const TABS: { id: Status; label: string }[] = [
  { id: "pending", label: "Waiting" },
  { id: "approved", label: "Approved" },
  { id: "declined", label: "Declined" },
];

function ago(iso: string) {
  const minutes = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (minutes < 60) return `${Math.max(1, minutes)} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/** The admin's review queue. Row-level security gives this data to the admin account only. */
export function StoriesReview() {
  const { user, ready, available } = useAuth();
  const [admin, setAdmin] = useState<boolean | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
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
      const { data, error: listError } = await client
        .from("stories")
        .select("id, created_at, status, realm, place, travelled_on, title, body, places, photos, author_name, author_email, decline_reason, reviewed_at")
        .order("created_at", { ascending: false })
        .limit(300);
      if (!live) return;
      if (listError) {
        setError("Couldn't load stories.");
        return;
      }
      const list = (data ?? []) as Row[];
      setRows(list);
      const paths = list.flatMap((row) => row.photos ?? []);
      if (paths.length) {
        const { data: signed } = await client.storage.from(STORY_BUCKET).createSignedUrls(paths, 60 * 60);
        const urls: Record<string, string> = {};
        for (const item of signed ?? []) if (item.path && item.signedUrl) urls[item.path] = item.signedUrl;
        if (live) setPhotoUrls(urls);
      }
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
        <h2 className="font-display text-2xl text-ink">Sign in to review stories</h2>
        <Link href="/account?next=/admin/stories" className="mt-5 inline-block rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-deep">
          Sign in
        </Link>
      </div>
    );
  }
  if (error) return <p className="rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>;
  if (admin === false) return <p className="rounded-2xl bg-paper-sunken px-4 py-3 text-sm text-ink-soft">This review queue is only for the site admin.</p>;
  if (admin === null || rows === null) return <p className="text-ink-faint">Loading stories…</p>;

  async function decide(row: Row, status: Status, declineReason: string | null = null) {
    if (!supabase) return;
    setBusy(row.id);
    const change = { status, reviewed_at: status === "pending" ? null : new Date().toISOString(), decline_reason: status === "declined" ? declineReason : null };
    const { error: updateError } = await supabase.from("stories").update(change).eq("id", row.id);
    setBusy(null);
    if (updateError) {
      setError("That change didn't save. Please try again.");
      return;
    }
    setRows((current) => (current ?? []).map((r) => (r.id === row.id ? { ...r, ...change } : r)));
    setDeclining(null);
    setReason("");
  }

  const counts = Object.fromEntries(TABS.map((t) => [t.id, rows.filter((row) => row.status === t.id).length])) as Record<Status, number>;
  const shown = rows.filter((row) => row.status === tab);

  return (
    <div className="overflow-hidden rounded-3xl border border-line bg-paper-raised">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
        <h2 className="font-display text-2xl text-ink">Stories to review</h2>
        <p className="text-[13px] text-ink-soft">Approved stories appear on the site within a few minutes. Declined ones stay private.</p>
      </div>
      <div className="flex flex-wrap gap-1.5 border-b border-line px-5 py-3 sm:px-6">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-pressed={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-full border px-3 py-1.5 text-[13px] transition ${tab === t.id ? "border-brand bg-brand text-white" : "border-line bg-paper text-ink hover:border-brand"}`}
          >
            {t.label} <span className="font-semibold tabular-nums">{counts[t.id]}</span>
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="px-6 py-10 text-center text-sm text-ink-faint">
          {tab === "pending" ? "Nothing waiting. New stories will appear here as soon as they're shared." : "Nothing here yet."}
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {shown.map((row) => (
            <li key={row.id} className="grid gap-5 px-5 py-5 sm:px-6 lg:grid-cols-[15rem_1fr_12rem]">
              <div className="grid grid-cols-3 gap-1.5 lg:grid-cols-2">
                {row.photos.length === 0 && <p className="col-span-full rounded-xl bg-paper px-3 py-6 text-center text-xs text-ink-faint">No photos</p>}
                {row.photos.map((path) =>
                  photoUrls[path] ? (
                    <a key={path} href={photoUrls[path]} target="_blank" rel="noopener noreferrer" className="block aspect-square overflow-hidden rounded-xl bg-paper-sunken">
                      {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed link to a private upload. */}
                      <img src={photoUrls[path]} alt="" className="h-full w-full object-cover" />
                    </a>
                  ) : (
                    <span key={path} className="shimmer block aspect-square rounded-xl" />
                  ),
                )}
              </div>

              <div className="min-w-0">
                <p className="text-xs text-ink-faint">
                  {row.realm === "beyond" ? "Out of this world · " : ""}
                  {row.place}
                  {row.travelled_on ? ` · ${row.travelled_on}` : ""} · sent {ago(row.created_at)}
                </p>
                <h3 className="mt-1 font-display text-xl leading-tight text-ink">{row.title}</h3>
                <p className="mt-2 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-ink">{row.body}</p>
                {row.places.length > 0 && (
                  <ul className="mt-3 flex flex-wrap gap-1.5">
                    {row.places.map((place) => (
                      <li key={`${place.kind}-${place.name}`} className="rounded-full border border-line bg-paper px-2.5 py-1 text-xs text-ink-soft">
                        {placeKindLabel(place.kind)} · <span className="font-semibold text-ink">{place.name}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {/https?:\/\/|www\./i.test(row.body) && <p className="mt-3 rounded-xl bg-gold/10 px-3 py-2 text-xs text-gold">Contains a link — check it before approving.</p>}
                <p className="mt-3 text-xs text-ink-faint">
                  By {row.author_name}
                  {row.author_email && (
                    <>
                      {" · "}
                      <a href={`mailto:${row.author_email}`} className="text-brand underline">
                        {row.author_email}
                      </a>
                    </>
                  )}{" "}
                  · agreed to publishing
                </p>
                {row.status === "declined" && row.decline_reason && <p className="mt-2 text-xs text-danger">Declined: {row.decline_reason}</p>}
              </div>

              <div className="grid content-start gap-2">
                {row.status !== "approved" && (
                  <button
                    type="button"
                    disabled={busy === row.id}
                    onClick={() => decide(row, "approved")}
                    className="rounded-full bg-brand px-4 py-2.5 text-sm font-semibold text-white transition enabled:hover:bg-brand-deep disabled:opacity-60"
                  >
                    {row.status === "declined" ? "Approve after all" : "Approve & publish"}
                  </button>
                )}
                {row.status !== "declined" &&
                  (declining === row.id ? (
                    <div className="grid gap-2">
                      <textarea
                        value={reason}
                        onChange={(event) => setReason(event.target.value.slice(0, 300))}
                        rows={3}
                        placeholder="Private reason, e.g. photos aren't the author's"
                        className="rounded-xl border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-brand"
                      />
                      <button
                        type="button"
                        disabled={busy === row.id}
                        onClick={() => decide(row, "declined", reason.trim() || null)}
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
                        setDeclining(row.id);
                        setReason("");
                      }}
                      className="rounded-full border border-line bg-paper-raised px-4 py-2.5 text-sm font-semibold text-danger transition hover:border-danger/50"
                    >
                      {row.status === "approved" ? "Unpublish" : "Decline"}
                    </button>
                  ))}
                {row.status !== "pending" && (
                  <button type="button" disabled={busy === row.id} onClick={() => decide(row, "pending")} className="text-xs text-ink-faint hover:text-ink">
                    Move back to waiting
                  </button>
                )}
                {row.status === "approved" && (
                  <Link href={`/stories/${row.id}`} className="text-center text-xs font-semibold text-brand hover:underline">
                    View on site
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
