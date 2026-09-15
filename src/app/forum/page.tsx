import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRightIcon } from "@/components/icons";
import { ForumIllustration } from "@/components/forum/ForumIllustration";
import { ForumSearch } from "@/components/forum/ForumSearch";
import { QuestionList } from "@/components/forum/QuestionList";
import { Footer, Nav } from "@/components/Shell";
import { StoryCard } from "@/components/stories/StoryCard";
import { FORUM_REGIONS, FORUM_THEMES } from "@/lib/forum";
import { forumTallies, publishedQuestions } from "@/lib/forum-server";
import { publishedStories } from "@/lib/stories-server";

/** New posts appear within five minutes of approval. */
export const revalidate = 300;

export const metadata: Metadata = {
  title: "Nativa Forum — ask travellers who've been there",
  description: "Ask a travel question, answer one from experience, or share a trip. Browse by destination or by the kind of trip. Every post is reviewed before it appears.",
  alternates: { canonical: "/forum" },
};

export default async function ForumPage() {
  const [questions, stories, tallies] = await Promise.all([publishedQuestions({ limit: 8 }), publishedStories({ limit: 3 }), forumTallies()]);

  return (
    <>
      <Nav />
      <main className="flex-1">
        <section className="bg-paper-sunken">
          <div className="mx-auto grid w-full max-w-6xl gap-8 px-5 pb-28 pt-10 sm:pb-32 sm:pt-12 lg:grid-cols-[1fr_minmax(0,32rem)] lg:items-end">
            <div>
              <ForumIllustration className="h-20 w-auto sm:h-24" />
              <h1 className="mt-5 font-display text-5xl font-semibold leading-none tracking-tight text-ink sm:text-6xl">Nativa Forum</h1>
            </div>
            <ForumSearch />
          </div>
        </section>

        <div className="mx-auto -mt-16 w-full max-w-6xl space-y-16 px-5 pb-8 sm:-mt-20">
          <section className="grid gap-10 rounded-[2rem] border border-line bg-paper-raised p-7 shadow-[0_30px_70px_-45px_rgba(13,47,66,0.45)] sm:p-12 lg:grid-cols-[1.1fr_2fr]">
            <div>
              <p className="text-balance font-display text-5xl leading-[1.02] text-ink sm:text-6xl">Ask. Share. Wander.</p>
              <p className="mt-8 max-w-sm text-2xl leading-snug text-ink">Ask travellers who&rsquo;ve already been.</p>
              <p className="mt-5 max-w-sm text-2xl leading-snug text-ink">Share what you found, so the next traveller finds it too.</p>
              <div className="mt-8 flex flex-wrap gap-2">
                <Link href="/forum/ask" className="rounded-full bg-brand px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-deep">
                  Ask a question
                </Link>
                <Link href="/stories/share" className="rounded-full border border-line-strong px-5 py-3 text-sm font-semibold text-ink transition hover:border-brand hover:text-brand">
                  Share a travel story
                </Link>
              </div>
              <p className="mt-6 text-sm text-ink-faint">Type or just speak. Our team reads every post before it appears.</p>
            </div>

            <div className="grid gap-10 sm:grid-cols-2">
              <nav aria-labelledby="by-destination">
                <h2 id="by-destination" className="text-lg font-semibold text-ink">
                  Browse by destination
                </h2>
                <ul className="mt-5 space-y-3.5">
                  {FORUM_REGIONS.map((region) => (
                    <li key={region.slug}>
                      <Link href={`/forum/regions/${region.slug}`} className="group inline-flex items-baseline gap-2 text-[17px] text-ink transition hover:text-brand">
                        <span className="underline-offset-4 group-hover:underline">{region.label}</span>
                        {tallies.regions[region.slug] ? <span className="text-xs tabular-nums text-ink-faint">{tallies.regions[region.slug]}</span> : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
              <nav aria-labelledby="by-theme">
                <h2 id="by-theme" className="text-lg font-semibold text-ink">
                  Browse by theme
                </h2>
                <ul className="mt-5 space-y-3.5">
                  {FORUM_THEMES.map((theme) => (
                    <li key={theme.slug}>
                      <Link href={`/forum/themes/${theme.slug}`} className="group inline-flex items-baseline gap-2 text-[17px] text-ink transition hover:text-brand">
                        <span className="underline-offset-4 group-hover:underline">{theme.label}</span>
                        {tallies.themes[theme.slug] ? <span className="text-xs tabular-nums text-ink-faint">{tallies.themes[theme.slug]}</span> : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            </div>
          </section>

          <section className="space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 className="font-display text-3xl text-ink sm:text-4xl">Latest questions</h2>
              <Link href="/forum/ask" className="text-sm font-semibold text-brand hover:underline">
                + Ask a question
              </Link>
            </div>
            {questions.length > 0 ? (
              <QuestionList questions={questions} />
            ) : (
              <div className="rounded-3xl border border-dashed border-line-strong px-6 py-10 text-center">
                <p className="font-display text-2xl text-ink">Start the first conversation</p>
                <p className="mx-auto mt-2 max-w-md text-[15px] text-ink-soft">Planning a trip? Ask what you&rsquo;d ask a friend who&rsquo;s been there.</p>
                <Link href="/forum/ask" className="mt-5 inline-block rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-deep">
                  Ask a question
                </Link>
              </div>
            )}
          </section>

          <section className="space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-display text-3xl text-ink sm:text-4xl">Traveller stories</h2>
                <p className="mt-1.5 text-[15px] text-ink-soft">Trips in travellers&rsquo; own words and photos, with the places they&rsquo;d pass on.</p>
              </div>
              <Link href="/stories" className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline">
                All stories <ArrowRightIcon className="h-3.5 w-3.5" />
              </Link>
            </div>
            {stories.length > 0 ? (
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {stories.map((story) => (
                  <li key={story.id}>
                    <StoryCard story={story} />
                  </li>
                ))}
              </ul>
            ) : (
              <div className="rounded-3xl border border-dashed border-line-strong px-6 py-10 text-center">
                <p className="font-display text-2xl text-ink">Been somewhere worth remembering?</p>
                <p className="mx-auto mt-2 max-w-md text-[15px] text-ink-soft">Share the trip, the stays and the food — yours could be the first story here.</p>
                <Link href="/stories/share" className="mt-5 inline-block rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-deep">
                  Share a travel story
                </Link>
              </div>
            )}
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
