"use client";

import Link from "next/link";
import { displayNameOf, useAuth } from "./AuthProvider";

/** "Sign in", or the traveller's initial and a way to their trips. Hidden when accounts are off. */
export function AccountLink({ onHero = false }: { onHero?: boolean }) {
  const { user, ready, available } = useAuth();
  if (!available || !ready) return null;

  const tone = onHero ? "text-white/80 hover:text-white" : "text-ink-soft hover:text-brand";

  if (!user) {
    return (
      <Link href="/account" className={`whitespace-nowrap rounded-lg px-2.5 py-2 text-sm transition sm:px-3 ${tone}`}>
        Sign in
      </Link>
    );
  }

  const name = displayNameOf(user);
  return (
    <span className="flex items-center gap-1">
      <Link href="/trips" className={`hidden rounded-lg px-3 py-2 text-sm transition sm:block ${tone}`}>
        My trips
      </Link>
      <Link
        href="/account"
        title={`Signed in as ${name}`}
        aria-label="Your account"
        className={`grid h-9 w-9 place-items-center rounded-full text-sm font-semibold uppercase transition ${
          onHero ? "bg-white/15 text-white ring-1 ring-white/30 hover:bg-white/25" : "bg-brand/10 text-brand hover:bg-brand hover:text-white"
        }`}
      >
        {name.charAt(0)}
      </Link>
    </span>
  );
}
