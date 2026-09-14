import type { Metadata } from "next";
import { MyTrips } from "@/components/MyTrips";
import { Footer, Nav } from "@/components/Shell";

export const metadata: Metadata = { title: "My trips — Nativa", robots: { index: false } };

export default function TripsPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-5 py-12">
        <header className="space-y-2">
          <h1 className="font-display text-4xl text-ink">My trips</h1>
          <p className="text-[15px] text-ink-soft">Trips you&rsquo;ve saved, and the ones friends have invited you to plan.</p>
        </header>
        <MyTrips />
      </main>
      <Footer />
    </>
  );
}
