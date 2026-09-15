import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRightIcon, DropletIcon } from "@/components/icons";
import { PinIcon } from "@/components/MapLink";
import { WaveDivider } from "@/components/PageHero";
import { Footer, Nav } from "@/components/Shell";
import { StoryCard } from "@/components/stories/StoryCard";
import { lastYearByMonth } from "@/lib/climate";
import { MOODS } from "@/lib/destinations/curation";
import { firstSentences, GUIDES, guideBySlug } from "@/lib/guides";
import { googleMapsUrl } from "@/lib/maps";
import { SITE_URL } from "@/lib/site";
import { publishedStories } from "@/lib/stories-server";

// Hourly, so newly approved traveller stories reach the guide the same day.
export const revalidate = 3600;
export const dynamicParams = false;

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return GUIDES.map((guide) => ({ slug: guide.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const guide = guideBySlug((await params).slug);
  if (!guide) return {};
  const title = `${guide.name} travel guide: weather by month and a local trip plan | Nativa`;
  const description = `Plan ${guide.name} like a local: real, mapped places arranged around your season, pace and interests. ${firstSentences(guide.extract, 1)}`.slice(0, 160);
  return {
    title,
    description,
    alternates: { canonical: `/destinations/${guide.slug}` },
    openGraph: { title, description, type: "article", images: [{ url: guide.photo, alt: guide.name }] },
  };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default async function GuidePage({ params }: Props) {
  const guide = guideBySlug((await params).slug);
  if (!guide) notFound();

  const [climate, stories] = await Promise.all([
    guide.lat !== null && guide.lng !== null ? lastYearByMonth(guide.lat, guide.lng) : Promise.resolve(null),
    publishedStories({ place: guide.name, realm: "earth", limit: 3 }),
  ]);
  const hottest = climate ? Math.max(...climate.months.map((m) => m.high)) : 0;
  const coldest = climate ? Math.min(...climate.months.map((m) => m.low)) : 0;
  const span = Math.max(1, hottest - coldest);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TouristDestination",
    name: guide.name,
    description: firstSentences(guide.extract, 2),
    url: `${SITE_URL}/destinations/${guide.slug}`,
    image: `${SITE_URL}${guide.photo}`,
    ...(guide.lat !== null && guide.lng !== null ? { geo: { "@type": "GeoCoordinates", latitude: guide.lat, longitude: guide.lng } } : {}),
  };

  return (
    <>
      <Nav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      <section className="relative isolate overflow-hidden bg-deep-2">
        <Image src={guide.photo} alt={guide.name} fill priority sizes="100vw" className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-deep-2/95 via-deep-2/65 to-deep-2/20" />
        <div className="relative mx-auto w-full max-w-6xl px-5 pb-28 pt-16 sm:pb-36 sm:pt-24">
          <h1 className="max-w-3xl text-balance font-display text-5xl font-semibold leading-[1.02] text-white sm:text-7xl">{guide.name}</h1>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-white/85 sm:text-lg">{firstSentences(guide.extract, 1)}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href={`/plan?q=${encodeURIComponent(`3 days in ${guide.name}`)}`}
              className="inline-flex items-center gap-2 rounded-full bg-gold-bright px-6 py-3.5 text-sm font-semibold text-deep transition hover:bg-white"
            >
              Plan 3 days in {guide.name} <ArrowRightIcon />
            </Link>
            <a
              href={googleMapsUrl(guide.name)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full px-5 py-3.5 text-sm font-semibold text-white ring-1 ring-white/40 transition hover:bg-white/10"
            >
              <PinIcon className="h-4 w-4" /> Open in Google Maps
            </a>
          </div>
        </div>
        <WaveDivider />
        <p className="pointer-events-none absolute bottom-[62px] right-3 z-10 text-[10px] text-white/55 sm:bottom-[92px]">
          Photo: {guide.credit}
        </p>
      </section>

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-16 px-5 py-12">
        <section className="grid gap-8 lg:grid-cols-12">
          <div className="space-y-3 lg:col-span-7">
            <h2 className="font-display text-3xl text-ink">About {guide.name}</h2>
            <p className="max-w-prose text-[15px] leading-relaxed text-ink-soft">{guide.extract}</p>
            {guide.wikipediaUrl && (
              <p className="text-xs text-ink-faint">
                Summary from{" "}
                <a href={guide.wikipediaUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-brand">
                  Wikipedia
                </a>
                , CC BY-SA.
              </p>
            )}
          </div>

          {climate && (
            <div className="space-y-3 rounded-3xl border border-line bg-paper-raised p-5 lg:col-span-5">
              <div className="flex items-baseline justify-between">
                <h2 className="font-display text-2xl text-ink">Month by month</h2>
                <span className="text-xs text-ink-faint">{climate.year}, Open-Meteo</span>
              </div>
              <ul className="space-y-1.5">
                {climate.months.map((m) => (
                  <li key={m.month} className="grid grid-cols-[2.25rem_1fr_auto] items-center gap-3 text-xs">
                    <span className="font-medium text-ink-soft">{MONTHS[m.month]}</span>
                    <span className="relative h-2 rounded-full bg-paper-sunken">
                      <span
                        className="absolute inset-y-0 rounded-full bg-gradient-to-r from-[#3f7fa0] via-gold-bright to-[#c46a45]"
                        style={{ left: `${((m.low - coldest) / span) * 100}%`, right: `${100 - ((m.high - coldest) / span) * 100}%` }}
                      />
                    </span>
                    <span className="flex items-center justify-end gap-1.5 tabular-nums text-ink-soft">
                      <span className="w-[3.25rem] text-right">
                        {m.low}°–{m.high}°
                      </span>
                      <span className="inline-flex w-8 items-center justify-end gap-0.5 text-ink-faint" title={`${m.rainyDays} rainy days`}>
                        {m.rainyDays}
                        <DropletIcon className="h-3 w-3 text-[#3f7fa0]" />
                        <span className="sr-only"> rainy days</span>
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-[11px] leading-relaxed text-ink-faint">
                Average lows and highs last year, and days with at least 1 mm of rain. A guide to packing, not a forecast.
              </p>
            </div>
          )}
        </section>

        <section className="space-y-5">
          <div>
            <h2 className="font-display text-3xl text-ink sm:text-4xl">{guide.name}, your way</h2>
            <p className="mt-1.5 text-[15px] text-ink-soft">Pick the kind of trip — we&rsquo;ll build it from real places.</p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {MOODS.map((mood) => (
              <li key={mood.id}>
                <Link
                  href={`/plan?q=${encodeURIComponent(`${mood.prompt} in ${guide.name}`)}`}
                  className="lift group flex h-full flex-col rounded-3xl border border-line bg-paper-raised p-5 transition-colors hover:border-brand/40"
                >
                  <span className="block font-display text-xl text-ink">
                    {mood.label} {guide.name}
                  </span>
                  <span className="mt-1.5 block flex-1 text-sm leading-relaxed text-ink-soft">{mood.prompt}.</span>
                  <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand">
                    Build this trip <ArrowRightIcon className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-3xl text-ink sm:text-4xl">Stories from {guide.name}</h2>
              <p className="mt-1.5 text-[15px] text-ink-soft">Real trips, shared by travellers and reviewed by our team.</p>
            </div>
            <Link
              href={`/stories/share?place=${encodeURIComponent(guide.name)}`}
              className="rounded-full border border-brand px-4 py-2 text-sm font-semibold text-brand transition hover:bg-brand hover:text-white"
            >
              + Share your story
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
            <p className="rounded-3xl border border-dashed border-line-strong px-5 py-8 text-center text-[15px] text-ink-soft">
              Been to {guide.name}? Yours could be the first story here — type it or just say it.
            </p>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-2xl text-ink">More city guides</h2>
          <div className="flex flex-wrap gap-2">
            {GUIDES.filter((g) => g.slug !== guide.slug).map((g) => (
              <Link key={g.slug} href={`/destinations/${g.slug}`} className="rounded-full border border-line bg-paper-raised px-4 py-2 text-sm text-ink-soft transition hover:border-brand hover:text-brand">
                {g.name}
              </Link>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
