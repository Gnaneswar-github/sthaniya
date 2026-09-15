import Link from "next/link";
import { QuestionList } from "./QuestionList";
import { Footer, Nav } from "../Shell";
import { StoryCard } from "../stories/StoryCard";
import type { ForumQuestion } from "@/lib/forum";
import type { PublishedStory } from "@/lib/stories";

/** One region or theme of the forum: its questions and stories, with ways to add to both. */
export function ForumTopic({
  crumb,
  title,
  blurb,
  askHref,
  questions,
  stories,
}: {
  crumb: string;
  title: string;
  blurb: string;
  askHref: string;
  questions: ForumQuestion[];
  stories: PublishedStory[];
}) {
  return (
    <>
      <Nav />
      <main className="flex-1">
        <section className="bg-paper-sunken">
          <div className="mx-auto w-full max-w-6xl px-5 py-10 sm:py-14">
            <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-sm text-ink-soft">
              <Link href="/forum" className="hover:text-brand">
                Forum
              </Link>
              <span aria-hidden>›</span>
              <span>{crumb}</span>
            </nav>
            <h1 className="mt-3 text-balance font-display text-4xl font-semibold leading-tight text-ink sm:text-5xl">{title}</h1>
            <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ink-soft">{blurb}</p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Link href={askHref} className="rounded-full bg-brand px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-deep">
                Ask a question
              </Link>
              <Link href="/stories/share" className="rounded-full border border-line-strong bg-paper-raised px-5 py-3 text-sm font-semibold text-ink transition hover:border-brand hover:text-brand">
                Share a travel story
              </Link>
            </div>
          </div>
        </section>

        <div className="mx-auto w-full max-w-6xl space-y-14 px-5 py-12">
          <section className="space-y-5">
            <h2 className="font-display text-3xl text-ink">Questions</h2>
            {questions.length > 0 ? (
              <QuestionList questions={questions} />
            ) : (
              <p className="rounded-3xl border border-dashed border-line-strong px-6 py-8 text-center text-[15px] text-ink-soft">
                Nothing asked here yet.{" "}
                <Link href={askHref} className="font-semibold text-brand hover:underline">
                  Ask the first question
                </Link>
                .
              </p>
            )}
          </section>

          <section className="space-y-5">
            <h2 className="font-display text-3xl text-ink">Traveller stories</h2>
            {stories.length > 0 ? (
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {stories.map((story) => (
                  <li key={story.id}>
                    <StoryCard story={story} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-3xl border border-dashed border-line-strong px-6 py-8 text-center text-[15px] text-ink-soft">
                Been on a trip like this?{" "}
                <Link href="/stories/share" className="font-semibold text-brand hover:underline">
                  Share the first story
                </Link>
                .
              </p>
            )}
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
