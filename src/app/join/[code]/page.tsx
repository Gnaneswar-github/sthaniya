import type { Metadata } from "next";
import { JoinTrip } from "@/components/JoinTrip";
import { Footer, Nav } from "@/components/Shell";

export const metadata: Metadata = { title: "Join a trip — Nativa", robots: { index: false } };

export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-md flex-1 space-y-6 px-5 py-16">
        <header className="text-center">
          <h1 className="font-display text-4xl text-ink">Join the trip</h1>
        </header>
        <JoinTrip code={code} />
      </main>
      <Footer />
    </>
  );
}
