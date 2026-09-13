import Link from "next/link";
import { CurrencySelector } from "./currency/CurrencyControls";

export function Nav() {
  return (
    <header className="sticky top-0 z-30 border-b border-line/80 bg-paper/85 backdrop-blur">
      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-3">
        <Link href="/" className="group flex items-baseline gap-2">
          <span className="font-display text-xl tracking-tight text-ink">Sthānīya</span>
          <span className="hidden text-[11px] text-ink-faint sm:inline">
            Travel like a local. Plan like you know the city.
          </span>
        </Link>

        <div className="flex items-center gap-1.5">
          <Link
            href="/#destinations"
            className="rounded-lg px-3 py-2 text-sm text-ink-soft transition hover:text-terracotta"
          >
            Destinations
          </Link>
          <Link
            href="/#gems"
            className="hidden rounded-lg px-3 py-2 text-sm text-ink-soft transition hover:text-terracotta sm:block"
          >
            Hidden gems
          </Link>
          <CurrencySelector />
          <Link
            href="/plan"
            className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-paper transition hover:bg-terracotta"
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
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-5 py-10 sm:grid-cols-3">
        <div className="space-y-2">
          <p className="font-display text-xl text-ink">Sthānīya</p>
          <p className="text-sm leading-relaxed text-ink-soft">
            Built for people with a few days in an unfamiliar city and no local friend to ask.
          </p>
        </div>

        <div className="space-y-2 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
            How we source places
          </p>
          <p className="leading-relaxed text-ink-soft">
            Verified places are researched and checked by a person before a city goes live.
            Everywhere else is sourced from Wikipedia and OpenStreetMap and labelled as such.
            We don&rsquo;t invent ratings, prices or reviews.
          </p>
        </div>

        <div className="space-y-2 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Credits</p>
          <p className="leading-relaxed text-ink-soft">
            Photography from Wikimedia Commons under Creative Commons licences, credited on
            each image. Geocoding by OpenStreetMap contributors.
          </p>
        </div>
      </div>
    </footer>
  );
}
