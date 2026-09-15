import type { Metadata } from "next";
import { Footer, Nav } from "@/components/Shell";
import { StoriesReview } from "@/components/stories/StoriesReview";

export const metadata: Metadata = { title: "Review stories — Nativa", robots: { index: false, follow: false } };

export default function StoriesAdminPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-5 py-12">
        <header className="space-y-2">
          <h1 className="font-display text-4xl text-ink">Traveller stories</h1>
          <p className="text-[15px] text-ink-soft">Approve a story to publish it on Nativa, or decline it to keep it private. Only you can see this page.</p>
        </header>
        <StoriesReview />
      </main>
      <Footer />
    </>
  );
}
