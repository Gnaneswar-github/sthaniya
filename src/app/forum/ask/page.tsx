import type { Metadata } from "next";
import Link from "next/link";
import { AskQuestionForm } from "@/components/forum/AskQuestionForm";
import { Footer, Nav } from "@/components/Shell";
import { regionBySlug, themeBySlug } from "@/lib/forum";

export const metadata: Metadata = {
  title: "Ask a travel question — Nativa Forum",
  description: "Ask travellers who've been there. Type it or just say it.",
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

export default async function AskPage({ searchParams }: Props) {
  const params = await searchParams;

  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-5 py-12">
        <header className="space-y-2">
          <nav aria-label="Breadcrumb" className="text-sm text-ink-soft">
            <Link href="/forum" className="hover:text-brand">
              Forum
            </Link>{" "}
            <span aria-hidden>›</span> Ask a question
          </nav>
          <h1 className="text-balance font-display text-4xl leading-tight text-ink sm:text-5xl">Ask travellers who&rsquo;ve been</h1>
          <p className="text-[15px] leading-relaxed text-ink-soft">What would you ask a friend who knows the place? Answers come from travellers, and our team reviews every post.</p>
        </header>
        <AskQuestionForm
          initialTitle={first(params.title).slice(0, 160)}
          initialRegion={regionBySlug(first(params.region))?.slug ?? ""}
          initialTheme={themeBySlug(first(params.theme))?.slug ?? ""}
          initialPlace={first(params.place).slice(0, 120)}
        />
      </main>
      <Footer />
    </>
  );
}
