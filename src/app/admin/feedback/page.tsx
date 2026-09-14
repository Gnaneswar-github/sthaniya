import type { Metadata } from "next";
import { FeedbackInbox } from "@/components/feedback/FeedbackInbox";
import { Footer, Nav } from "@/components/Shell";

export const metadata: Metadata = { title: "Feedback inbox — Nativa", robots: { index: false, follow: false } };

export default function FeedbackAdminPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-5 py-12">
        <header className="space-y-2">
          <h1 className="font-display text-4xl text-ink">Feedback</h1>
          <p className="text-[15px] text-ink-soft">Notes from people using Nativa. Only you can see this page.</p>
        </header>
        <FeedbackInbox />
      </main>
      <Footer />
    </>
  );
}
