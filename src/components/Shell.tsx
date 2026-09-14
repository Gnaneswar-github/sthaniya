import Link from "next/link";
import { AccountLink } from "./AccountLink";
import { Wordmark } from "./Logo";
import { CurrencySelector } from "./currency/CurrencyControls";

/**
 * `overHero` gives the homepage a transparent nav that sits on the photograph; every other
 * page gets the solid paper treatment.
 */
export function Nav({ overHero = false }: { overHero?: boolean }) {
  const link = overHero ? "text-white/85 hover:text-white" : "text-ink-soft hover:text-brand";

  return (
    <header
      className={
        overHero
          ? "absolute inset-x-0 top-0 z-30"
          : "sticky top-0 z-30 border-b border-line/80 bg-paper/90 backdrop-blur"
      }
    >
      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between gap-2 px-4 py-3.5 sm:gap-4 sm:px-5 sm:py-4">
        <Link href="/" aria-label="Nativa home" className="shrink-0">
          <Wordmark
            markClassName={`h-7 w-7 ${overHero ? "text-brand-bright" : "text-brand"}`}
            textClassName={`font-display text-xl tracking-tight ${overHero ? "text-white" : "text-ink"}`}
          />
        </Link>

        <div className="flex min-w-0 items-center gap-0.5 sm:gap-1">
          <Link href="/destinations" className={`whitespace-nowrap rounded-lg px-2.5 py-2 text-sm transition sm:px-3 ${link}`}>
            <span className="sm:hidden">Guides</span>
            <span className="hidden sm:inline">City guides</span>
          </Link>

          <span className="mx-1.5 hidden sm:block">
            <CurrencySelector onHero={overHero} />
          </span>

          <AccountLink onHero={overHero} />

          <Link
            href="/plan"
            className={`ml-1 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition ${
              overHero ? "bg-white text-deep hover:bg-gold-bright" : "bg-brand text-white hover:bg-brand-deep"
            }`}
          >
            Plan a trip
          </Link>
        </div>
      </nav>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="mt-16 border-t border-line bg-paper-sunken">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-5 py-12 sm:grid-cols-3">
        <div className="space-y-2">
          <Wordmark markClassName="h-6 w-6 text-brand" textClassName="font-display text-lg text-ink" />
          <p className="text-sm leading-relaxed text-ink-soft">
            Built for people with a few days in an unfamiliar city and no local friend to ask.
          </p>
        </div>

        <div className="space-y-2 text-sm">
          <h2 className="font-semibold text-ink">How we source places</h2>
          <p className="leading-relaxed text-ink-soft">
            Every place is a real, mapped location from OpenStreetMap and Wikipedia, with a
            hand-checked set for some cities. We don&rsquo;t invent ratings, prices or reviews —
            each place name opens Google Maps, where you can see its own.
          </p>
        </div>

        <div className="space-y-2 text-sm">
          <h2 className="font-semibold text-ink">Credits</h2>
          <p className="leading-relaxed text-ink-soft">
            Photography from Wikimedia Commons under Creative Commons licences, credited on each
            image. Hero: Santorini by Sidvics, CC BY-SA 4.0. Geocoding by OpenStreetMap
            contributors. Exchange rates from the European Central Bank.
          </p>
        </div>
      </div>
    </footer>
  );
}
