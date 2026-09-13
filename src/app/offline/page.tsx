import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Offline — Sthānīya", robots: { index: false } };

export default function Offline() {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-lg flex-col items-center justify-center gap-4 px-5 text-center">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-brand">No connection</p>
      <h1 className="font-display text-4xl text-ink">You&rsquo;re offline</h1>
      <p className="text-[15px] leading-relaxed text-ink-soft">
        Anything you&rsquo;ve already opened is still here, including your saved trip. New trips need a connection to find
        places.
      </p>
      <Link href="/plan" className="rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white">
        Open my trip
      </Link>
    </main>
  );
}
