import type { Metadata } from "next";
import { Suspense } from "react";
import { AccountPanel } from "@/components/AccountPanel";
import { Footer, Nav } from "@/components/Shell";

export const metadata: Metadata = { title: "Your account — Nativa", robots: { index: false } };

export default function AccountPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-md flex-1 space-y-8 px-5 py-14">
        <header className="space-y-3 text-center">
          <h1 className="text-balance font-display text-4xl leading-tight text-ink">Keep your trips, everywhere</h1>
          <p className="text-[15px] leading-relaxed text-ink-soft">
            Save trips to your account, open them on any device, and plan together with the people you&rsquo;re travelling with.
          </p>
        </header>
        <div className="rounded-3xl border border-line bg-paper-raised p-6 shadow-[0_24px_60px_-40px_rgba(13,47,66,0.5)] sm:p-7">
          <Suspense fallback={<p className="text-ink-faint">Loading…</p>}>
            <AccountPanel />
          </Suspense>
        </div>
      </main>
      <Footer />
    </>
  );
}
