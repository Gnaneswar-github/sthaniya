"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "./AuthProvider";
import { PageHero } from "./PageHero";
import { TripView } from "./TripView";
import { track } from "@/lib/analytics";
import {
  castVote,
  listMembers,
  listVotes,
  loadCloudTrip,
  subscribeToTrip,
  updateCloudTrip,
  type CloudTrip,
  type Member,
  type Vote,
} from "@/lib/cloud-trips";
import type { Trip } from "@/lib/types";

type Status = "loading" | "ready" | "missing" | "error";

/**
 * A trip that lives in an account. Edits save shortly after they happen; edits and votes from
 * other members arrive live. The last save wins — a deliberate trade for a small group planning
 * a holiday, rather than a document editor's merge machinery.
 */
export function CloudTripView({ id }: { id: string }) {
  const { user, ready, available } = useAuth();
  const router = useRouter();
  const [row, setRow] = useState<CloudTrip | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [saving, setSaving] = useState(false);
  const pendingSave = useRef<number | null>(null);
  const lastLocalEdit = useRef(0);

  useEffect(() => {
    if (!user) return;
    let live = true;

    Promise.all([loadCloudTrip(id), listMembers(id), listVotes(id)])
      .then(([trip, people, tallies]) => {
        if (!live) return;
        if (!trip) {
          setStatus("missing");
          return;
        }
        setRow(trip);
        setMembers(people);
        setVotes(tallies);
        setStatus("ready");
      })
      .catch(() => {
        if (live) setStatus("error");
      });

    const unsubscribe = subscribeToTrip(id, {
      onTrip: (next) => {
        // Ignore the echo of our own save, which would briefly undo a quick second edit.
        if (Date.now() - lastLocalEdit.current < 2000) return;
        setRow((current) => (current ? { ...current, ...next } : next));
      },
      onVotes: () => {
        listVotes(id)
          .then((tallies) => live && setVotes(tallies))
          .catch(() => undefined);
      },
      onMembers: () => {
        listMembers(id)
          .then((people) => live && setMembers(people))
          .catch(() => undefined);
      },
    });

    return () => {
      live = false;
      unsubscribe();
      if (pendingSave.current) window.clearTimeout(pendingSave.current);
    };
  }, [id, user]);

  if (!available) return <Centered>Accounts aren&rsquo;t switched on for this deployment yet.</Centered>;
  if (!ready) return <Centered>Checking your session…</Centered>;
  if (!user) {
    return (
      <Centered>
        <p className="mb-4">Sign in to open this trip.</p>
        <Link href={`/account?next=${encodeURIComponent(`/trips/${id}`)}`} className="rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white">
          Sign in
        </Link>
      </Centered>
    );
  }
  if (status === "loading") return <Centered>Opening your trip…</Centered>;
  if (status === "missing" || status === "error" || !row) {
    return (
      <Centered>
        <p className="mb-4">This trip isn&rsquo;t available — it may have been deleted, or you haven&rsquo;t been invited to it.</p>
        <Link href="/trips" className="rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white">
          My trips
        </Link>
      </Centered>
    );
  }

  const trip = row.data;

  function change(next: Trip) {
    lastLocalEdit.current = Date.now();
    setRow((current) => (current ? { ...current, data: next } : current));
    if (pendingSave.current) window.clearTimeout(pendingSave.current);
    pendingSave.current = window.setTimeout(() => {
      setSaving(true);
      const snapshot = row;
      updateCloudTrip(id, { trip: next, pool: snapshot?.pool ?? [], meta: snapshot?.meta ?? null })
        .catch(() => undefined)
        .finally(() => {
          lastLocalEdit.current = Date.now();
          setSaving(false);
        });
    }, 700);
  }

  function vote(placeId: string, value: -1 | 0 | 1) {
    if (!user) return;
    setVotes((current) => {
      const others = current.filter((v) => !(v.placeId === placeId && v.userId === user.id));
      return value === 0 ? others : [...others, { placeId, userId: user.id, value }];
    });
    track("stop_voted", { value });
    castVote(id, placeId, user.id, value).catch(() => undefined);
  }

  return (
    <>
      <PageHero
        phase="dawn"
        title={trip.prefs.destination}
        subtitle={`${trip.days.length} ${trip.days.length === 1 ? "day" : "days"}, ${trip.days.flatMap((d) => d.items).length} stops — saved to your account.`}
      />
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-5 px-5 py-8">
        <TripView
          trip={trip}
          pool={row.pool}
          onChange={change}
          onRestart={() => router.push("/")}
          collab={{ userId: user.id, members, votes, inviteCode: row.invite_code, onVote: vote, saving }}
        />
      </main>
    </>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto w-full max-w-lg flex-1 px-5 py-24 text-center text-ink-soft">{children}</main>;
}
