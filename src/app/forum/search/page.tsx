import type { Metadata } from "next";
import Link from "next/link";
import { ForumSearch } from "@/components/forum/ForumSearch";
import { QuestionList } from "@/components/forum/QuestionList";
import { Footer, Nav } from "@/components/Shell";
import { StoryCard } from "@/components/stories/StoryCard";
import { publishedQuestions } from "@/lib/forum-server";
import { publishedStories } from "@/lib/stories-server";
import { cleanSearchTerm } from "@/lib/supabase-public";

export const metadata: Metadata = { title: "Search the forum — Nativa", robots: { index: false, follow: true } };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function ForumSearchPage({ searchParams }: Props) {
  const raw = (await searchParams).q;
  const typed = ((Array.isArray(raw) ? raw[0] : raw) ?? "").slice(0, 80);
  const term = cleanSearchTerm(typed);
  const [questions, stories] = term.length >= 2 ? await Promise.all([publishedQuestions({ search: term, limit: 40 }), publishedStories({ search: term, limit: 12 })]) : [[], []];
  const nothing = term.length >= 2 && questions.length === 0 && stories.length === 0;

  return (
    <>
      <Nav />
      <main className="flex-1">
        <section className="bg-paper-sunken">
          <div className="mx-auto w-full max-w-4xl space-y-4 px-5 py-10">
            <nav aria-label="Breadcrumb" className="text-sm text-ink-soft">
              <Link href="/forum" className="hover:text-brand">
                Forum
              </Link>{" "}
              <span aria-hidden>›</span> Search
            </nav>
            <h1 className="font-display text-4xl text-ink">{term ? <>Results for &ldquo;{typed.trim()}&rdquo;</> : "Search the forum"}</h1>
            <ForumSearch defaultValue={typed} />
          </div>
        </section>

        <div className="mx-auto w-full max-w-4xl space-y-12 px-5 py-10">
          {nothing && (
            <div className="rounded-3xl border border-dashed border-line-strong px-6 py-10 text-center">
              <p className="font-display text-2xl text-ink">Nobody has asked this yet</p>
              <p className="mx-auto mt-2 max-w-md text-[15px] text-ink-soft">Ask it — a traveller who&rsquo;s been may know the answer.</p>
              <Link
                href={`/forum/ask?title=${encodeURIComponent(typed.trim())}`}
                className="mt-5 inline-block rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-deep"
              >
                Ask this question
              </Link>
            </div>
          )}

          {questions.length > 0 && (
            <section className="space-y-4">
              <h2 className="font-display text-2xl text-ink">Questions</h2>
              <QuestionList questions={questions} />
            </section>
          )}

          {stories.length > 0 && (
            <section className="space-y-4">
              <h2 className="font-display text-2xl text-ink">Traveller stories</h2>
              <ul className="grid gap-4 sm:grid-cols-2">
                {stories.map((story) => (
                  <li key={story.id}>
                    <StoryCard story={story} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
