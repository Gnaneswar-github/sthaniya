import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRightIcon } from "@/components/icons";
import { Footer, Nav } from "@/components/Shell";
import { GUIDES } from "@/lib/guides";

export const metadata: Metadata = {
  title: "City guides — plan a local trip anywhere | Nativa",
  description:
    "Guides to cities people love — Kyoto, Lisbon, Hanoi, Oaxaca and more — with last year's weather month by month and trips built from real, mapped places.",
  alternates: { canonical: "/destinations" },
};

export default function Destinations() {
  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-8 px-5 py-12">
        <header className="max-w-2xl space-y-3">
          <h1 className="text-balance font-display text-4xl leading-tight text-ink sm:text-5xl">Where would you like to wander?</h1>
          <p className="text-[15px] leading-relaxed text-ink-soft">
            Each guide has what a city was like month by month last year, and a trip we can build around you in seconds. Any
            other city works too — just type it on the home page.
          </p>
        </header>

        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {GUIDES.map((guide) => (
            <li key={guide.slug}>
              <Link href={`/destinations/${guide.slug}`} className="lift group block overflow-hidden rounded-3xl bg-deep-2">
                <div className="relative aspect-[4/5]">
                  <Image
                    src={guide.photo}
                    alt={`${guide.name}`}
                    fill
                    sizes="(max-width: 640px) 50vw, 280px"
                    className="object-cover transition-transform duration-700 group-hover:scale-[1.05]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-deep-2/90 via-deep-2/10 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-4">
                    <h2 className="font-display text-xl leading-tight text-white sm:text-2xl">{guide.name}</h2>
                    <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-white/80 transition group-hover:text-gold-bright">
                      Read the guide <ArrowRightIcon className="h-3 w-3" />
                    </p>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </main>
      <Footer />
    </>
  );
}
