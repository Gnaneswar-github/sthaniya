import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/PageHero";
import { Footer, Nav } from "@/components/Shell";
import { StoryCard } from "@/components/stories/StoryCard";
import { communitySections } from "@/lib/community";
import { publishedStories } from "@/lib/stories-server";

/** Approved stories appear within five minutes of review. */
export const revalidate = 300;

export const metadata: Metadata = {
  title: "Traveller stories — Nativa",
  description: "Real trips shared by travellers: the places they stayed, ate and wandered, with their own photos. Every story is reviewed before it's published.",
  alternates: { canonical: "/stories" },
};

export default async function StoriesPage() {
  const [stories, sections] = await Promise.all([publishedStories({ limit: 90 }), communitySections()]);
  const earth = stories.filter((story) => story.realm === "earth");
  const beyond = stories.filter((story) => story.realm === "beyond");

  return (
    <>
      <Nav />
      <PageHero
        phase="dusk"
        title="Traveller stories"
        subtitle="Real trips from people who've been there — the places they'd pass on, in their own words and photos."
      >
        <div className="flex flex-wrap gap-2">
          <Link href="/stories/share" className="inline-flex rounded-full bg-gold-bright px-6 py-3 text-sm font-semibold text-deep transition hover:bg-white">
            Share your story
          </Link>
          {sections.forum && (
            <Link href="/forum" className="inline-flex rounded-full px-5 py-3 text-sm font-semibold text-white ring-1 ring-white/40 transition hover:bg-white/10">
              Visit the forum
            </Link>
          )}
        </div>
      </PageHero>

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-14 px-5 py-10">
        {stories.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-line-strong p-10 text-center">
            <h2 className="font-display text-2xl text-ink">The first stories are on their way</h2>
            <p className="mx-auto mt-2 max-w-md text-[15px] text-ink-soft">Been somewhere worth remembering? Share it, and it could be the first one here.</p>
            <Link href="/stories/share" className="mt-5 inline-block rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-deep">
              Share your story
            </Link>
          </div>
        ) : (
          <>
            {earth.length > 0 && (
              <section className="space-y-5">
                <h2 className="font-display text-3xl text-ink">Around the world</h2>
                <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {earth.map((story) => (
                    <li key={story.id}>
                      <StoryCard story={story} />
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {beyond.length > 0 && (
              <section className="space-y-5">
                <div>
                  <h2 className="font-display text-3xl text-ink">Out of this world</h2>
                  <p className="mt-1.5 text-[15px] text-ink-soft">Space flights, auroras, the nights that didn&rsquo;t feel like this planet.</p>
                </div>
                <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {beyond.map((story) => (
                    <li key={story.id}>
                      <StoryCard story={story} />
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </main>
      <Footer />
    </>
  );
}
