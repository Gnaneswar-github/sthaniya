import type { Metadata } from "next";
import { AdminNav } from "@/components/AdminNav";
import { ForumReview } from "@/components/forum/ForumReview";
import { Footer, Nav } from "@/components/Shell";

export const metadata: Metadata = { title: "Review the forum — Nativa", robots: { index: false, follow: false } };

export default function ForumAdminPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-5 py-12">
        <header className="space-y-3">
          <AdminNav current="/admin/forum" />
          <h1 className="font-display text-4xl text-ink">Forum</h1>
          <p className="text-[15px] text-ink-soft">Approve questions and replies to publish them, or decline to keep them private. Only you can see this page.</p>
        </header>
        <ForumReview />
      </main>
      <Footer />
    </>
  );
}
