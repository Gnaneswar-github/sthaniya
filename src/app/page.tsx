import { Suspense } from "react";
import { MoodGrid, SurpriseMe, WhereNext } from "@/components/DiscoverRails";
import { ScrollWorld } from "@/components/ScrollWorld";
import { Footer, Nav } from "@/components/Shell";
import { dailyPicks } from "@/lib/destinations/curation";

/** Re-rendered hourly, so the "fresh picks" genuinely change from one day to the next. */
export const revalidate = 3600;

export default function Home() {
  const picks = dailyPicks(8);

  return (
    <>
      <ScrollWorld nav={<Nav overHero />} />

      {/* Each section below the story is its own Suspense boundary, so React hydrates them one at a
          time and the browser can handle scrolling and typing in between — rather than bringing
          the whole page to life in a single long task. */}
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-16 px-5 pb-8 pt-12 sm:space-y-20 sm:pt-16">
        <Suspense>
          <WhereNext destinations={picks} />
        </Suspense>
        <Suspense>
          <MoodGrid />
        </Suspense>
        <Suspense>
          <SurpriseMe />
        </Suspense>
      </main>

      <Footer />
    </>
  );
}
