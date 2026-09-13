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

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-16 px-5 pb-8 pt-12 sm:space-y-20 sm:pt-16">
        <WhereNext destinations={picks} />
        <MoodGrid />
        <SurpriseMe />
      </main>

      <Footer />
    </>
  );
}
