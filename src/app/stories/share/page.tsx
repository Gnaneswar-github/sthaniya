import type { Metadata } from "next";
import { Footer, Nav } from "@/components/Shell";
import { StoryShareForm } from "@/components/stories/StoryShareForm";

export const metadata: Metadata = {
  title: "Share a travel memory — Nativa",
  description: "Tell other travellers about a place you loved: where you stayed, ate and wandered. Type it or just say it.",
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function ShareStoryPage({ searchParams }: Props) {
  const raw = (await searchParams).place;
  const initialPlace = (Array.isArray(raw) ? raw[0] : raw)?.slice(0, 120) ?? "";

  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-5 py-12">
        <header className="space-y-2">
          <h1 className="text-balance font-display text-4xl leading-tight text-ink sm:text-5xl">Share a travel memory</h1>
          <p className="text-[15px] leading-relaxed text-ink-soft">
            The places you&rsquo;d tell a friend about. Our team reads every story before it goes on Nativa.
          </p>
        </header>
        <StoryShareForm initialPlace={initialPlace} />
      </main>
      <Footer />
    </>
  );
}
