import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "@/components/icons";
import { MapLink } from "@/components/MapLink";
import { Footer, Nav } from "@/components/Shell";
import { placeKindLabel } from "@/lib/stories";
import { publishedStory } from "@/lib/stories-server";

export const revalidate = 300;

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const story = await publishedStory((await params).id);
  if (!story) return { title: "Story not found — Nativa" };
  return { title: `${story.title} — a traveller story from ${story.place} | Nativa`, description: story.body.slice(0, 155) };
}

export default async function StoryPage({ params }: Props) {
  const story = await publishedStory((await params).id);
  if (!story) notFound();

  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-8 px-5 py-10">
        <Link href="/stories" className="inline-flex items-center gap-1.5 text-sm text-ink-soft transition hover:text-brand">
          <ArrowLeftIcon /> All traveller stories
        </Link>

        <header className="space-y-3">
          <p className="text-sm text-ink-soft">
            {story.realm === "beyond" ? "Out of this world · " : ""}
            {story.place}
            {story.travelled_on ? ` · ${story.travelled_on}` : ""}
          </p>
          <h1 className="text-balance font-display text-4xl leading-tight text-ink sm:text-5xl">{story.title}</h1>
          <p className="flex items-center gap-2 text-sm text-ink-soft">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-brand text-sm font-semibold uppercase text-white">{story.author_name.charAt(0)}</span>
            Shared by <span className="font-semibold text-ink">{story.author_name}</span>
          </p>
        </header>

        {story.photoUrls.length > 0 && (
          <div className={`grid gap-2 ${story.photoUrls.length > 1 ? "sm:grid-cols-2" : ""}`}>
            {story.photoUrls.map((url, index) => (
              <div key={url} className={`overflow-hidden rounded-3xl bg-paper-sunken ${index === 0 && story.photoUrls.length % 2 === 1 && story.photoUrls.length > 1 ? "sm:col-span-2" : ""}`}>
                {/* eslint-disable-next-line @next/next/no-img-element -- signed link to the traveller's own, already-resized upload. */}
                <img src={url} alt={`Photo ${index + 1} from ${story.place}`} loading={index === 0 ? "eager" : "lazy"} decoding="async" className="h-full max-h-[34rem] w-full object-cover" />
              </div>
            ))}
          </div>
        )}

        <div className="max-w-prose space-y-4 text-[17px] leading-relaxed text-ink">
          {story.body
            .split(/\n{2,}/)
            .filter(Boolean)
            .map((paragraph, index) => (
              <p key={index} className="whitespace-pre-line">
                {paragraph}
              </p>
            ))}
        </div>

        {story.places.length > 0 && (
          <section className="space-y-3 rounded-3xl border border-line bg-paper-raised p-5">
            <h2 className="font-display text-2xl text-ink">Places {story.author_name.split(" ")[0]} recommends</h2>
            <ul className="divide-y divide-line">
              {story.places.map((place) => (
                <li key={`${place.kind}-${place.name}`} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="min-w-0">
                    {story.realm === "earth" ? (
                      <MapLink name={place.name} near={story.place} className="text-[15px] text-ink" />
                    ) : (
                      <span className="text-[15px] text-ink">{place.name}</span>
                    )}
                  </span>
                  <span className="shrink-0 rounded-full bg-paper px-2.5 py-1 text-xs text-ink-soft">{placeKindLabel(place.kind)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="text-xs text-ink-faint">Shared by a traveller and reviewed by the Nativa team. Places and photos are the author&rsquo;s own.</p>

        <div className="flex flex-wrap gap-2">
          <Link href="/stories/share" className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-deep">
            Share your own story
          </Link>
          {story.realm === "earth" && (
            <Link
              href={`/plan?q=${encodeURIComponent(`3 days in ${story.place}`)}`}
              className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold text-ink-soft transition hover:border-brand hover:text-brand"
            >
              Plan a trip to {story.place.split(",")[0]}
            </Link>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
