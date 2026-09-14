"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "./AuthProvider";
import { track } from "@/lib/analytics";
import { joinTrip } from "@/lib/cloud-trips";

/** Accepts an invite link: sign in if needed, join, then open the trip. */
export function JoinTrip({ code }: { code: string }) {
  const { user, ready, available } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let live = true;
    joinTrip(code)
      .then((tripId) => {
        track("trip_joined");
        if (live) router.replace(`/trips/${tripId}`);
      })
      .catch((e: unknown) => {
        if (live) setError(e instanceof Error ? e.message : "That invite didn't work.");
      });
    return () => {
      live = false;
    };
  }, [user, code, router]);

  if (!available) return <p className="text-center text-ink-soft">Accounts aren&rsquo;t switched on for this deployment yet.</p>;
  if (!ready) return <p className="text-center text-ink-faint">Checking your session…</p>;
  if (!user) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-[15px] text-ink-soft">You&rsquo;ve been invited to plan a trip together. Sign in to join — it takes a moment.</p>
        <Link
          href={`/account?next=${encodeURIComponent(`/join/${code}`)}`}
          className="inline-block rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-deep"
        >
          Sign in to join
        </Link>
      </div>
    );
  }
  if (error) {
    return (
      <div className="space-y-4 text-center">
        <p className="rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>
        <p className="text-sm text-ink-soft">Ask whoever sent it for a fresh invite link.</p>
      </div>
    );
  }
  return <p className="text-center text-ink-faint">Joining the trip…</p>;
}
