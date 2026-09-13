import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PinIcon } from "@/components/MapLink";
import { WaveDivider } from "@/components/PageHero";
import { Footer, Nav } from "@/components/Shell";
import { lastYearByMonth } from "@/lib/climate";
import { MOODS } from "@/lib/destinations/curation";
import { firstSentences, GUIDES, guideBySlug } from "@/lib/guides";
import { googleMapsUrl } from "@/lib/maps";
import { SITE_URL } from "@/lib/site";

export const revalidate = 2_592_000;
export const dynamicParams = false;

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return GUIDES.map((guide) => ({ slug: guide.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const guide = guideBySlug((await params).slug);
  if (!guide) return {};
  const title = `${guide.name} travel guide: weather by month and a local trip plan | Sthānīya`;
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

  const climate = guide.lat !== null && guide.lng !== null ? await lastYearByMonth(guide.lat, guide.lng) : null;
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
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-gold-bright/90">City guide</p>
          <h1 className="mt-3 max-w-3xl font-display text-5xl font-semibold leading-[1.02] text-white sm:text-7xl">{guide.name}</h1>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-white/80 sm:text-lg">{firstSentences(guide.extract, 1)}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href={`/plan?q=${encodeURIComponent(`3 days in ${guide.name}`)}`}
              className="rounded-full bg-gold-bright px-6 py-3.5 text-sm font-semibold text-deep transition hover:bg-white"
            >
              Plan 3 days in {guide.name} →
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
        <p className="pointer-events-none absolute bottom-[62px] right-3 z-10 text-[10px] text-white/50 sm:bottom-[92px]">
          Photo: {guide.credit}
        </p>
      </section>

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-14 px-5 py-12">
        <section className="grid gap-8 lg:grid-cols-12">
          <div className="space-y-3 lg:col-span-7">
            <h2 className="font-display text-3xl text-ink">About {guide.name}</h2>
            <p className="text-[15px] leading-relaxed text-ink-soft">{guide.extract}</p>
            {guide.wikipediaUrl && (
              <p className="text-xs text-ink-faint">
                Summary from{" "}
                <a href={guide.wikipediaUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-brand">
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
                  <li key={m.month} className="grid grid-cols-[2.5rem_1fr_4.5rem] items-center gap-3 text-xs">
                    <span className="font-medium text-ink-soft">{MONTHS[m.month]}</span>
                    <span className="relative h-2 rounded-full bg-paper-sunken">
                      <span
                        className="absolute inset-y-0 rounded-full bg-gradient-to-r from-[#3f7fa0] via-gold-bright to-[#c46a45]"
                        style={{ left: `${((m.low - coldest) / span) * 100}%`, right: `${100 - ((m.high - coldest) / span) * 100}%` }}
                      />
                    </span>
                    <span className="text-right tabular-nums text-ink-faint">
                      {m.low}°–{m.high}° · {m.rainyDays}☂
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
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-brand">Trip ideas</p>
            <h2 className="mt-1.5 font-display text-3xl text-ink sm:text-4xl">{guide.name}, your way</h2>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {MOODS.map((mood) => (
              <li key={mood.id}>
                <Link
                  href={`/plan?q=${encodeURIComponent(`${mood.prompt} in ${guide.name}`)}`}
                  className="lift block h-full rounded-3xl border border-line bg-paper-raised p-5"
                >
                  <span className="block font-display text-xl text-ink">
                    {mood.label} {guide.name}
                  </span>
                  <span className="mt-1.5 block text-sm leading-relaxed text-ink-soft">{mood.prompt}.</span>
                  <span className="mt-3 block text-xs font-semibold text-brand">Build this trip →</span>
                </Link>
              </li>
            ))}
          </ul>
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
