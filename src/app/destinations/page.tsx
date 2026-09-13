import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Footer, Nav } from "@/components/Shell";
import { GUIDES } from "@/lib/guides";

export const metadata: Metadata = {
  title: "City guides — plan a local trip anywhere | Sthānīya",
  description:
    "Guides to cities people love — Kyoto, Lisbon, Hanoi, Oaxaca and more — with last year's weather month by month and trips built from real, mapped places.",
  alternates: { canonical: "/destinations" },
};

export default function Destinations() {
  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-8 px-5 py-12">
        <header className="max-w-2xl space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-brand">City guides</p>
          <h1 className="font-display text-4xl leading-tight text-ink sm:text-5xl">Where would you like to wander?</h1>
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
                  <div className="absolute inset-0 bg-gradient-to-t from-deep-2/90 via-transparent to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-4">
                    <h2 className="font-display text-2xl text-white">{guide.name}</h2>
                    <p className="text-xs text-white/70">Read the guide →</p>
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
