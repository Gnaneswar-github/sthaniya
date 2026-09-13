import { CategoryStrip, DestinationRail, MoodGrid, SurpriseMe } from "@/components/DiscoverRails";
import { Hero } from "@/components/Hero";
import { PlaceRail } from "@/components/PlaceRail";
import { Footer, Nav } from "@/components/Shell";
import { TrustStrip } from "@/components/TrustStrip";
import { DESTINATIONS, RAILS, destinationById } from "@/lib/destinations/curation";
import { getRecommendations } from "@/lib/recommendations";
import { SUPPORTED_CITIES } from "@/lib/types";

export default async function Home() {
  // The verified rails come from the same set the planner uses — one source, no duplication.
  const verified = (await Promise.all(SUPPORTED_CITIES.map(getRecommendations))).flat();
  const gems = verified.filter((p) => p.tag === "hidden_gem");
  const food = verified.filter((p) => p.category === "food" || p.category === "cafe");

  return (
    <>
      <div className="relative">
        <Nav overHero />
        <Hero />
      </div>

      <TrustStrip />

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-14 px-5 py-12">
        <section id="destinations" className="space-y-11">
          {RAILS.map((rail) => (
            <DestinationRail
              key={rail.id}
              title={rail.title}
              blurb={rail.blurb}
              destinations={rail.destinationIds
                .map(destinationById)
                .filter((d): d is NonNullable<typeof d> => Boolean(d))}
            />
          ))}
        </section>

        <MoodGrid />

        <CategoryStrip />

        <section id="gems" className="space-y-11">
          <PlaceRail
            title="Hidden in plain sight"
            blurb="Places in our verified set that almost nobody visiting for the first time reaches."
            places={gems}
          />
          <PlaceRail
            title="Eat where the city eats"
            blurb="Not the best-reviewed. The ones people go back to."
            places={food}
          />
        </section>

        <SurpriseMe />

        <section className="overflow-hidden rounded-3xl bg-deep px-6 py-10 sm:px-10 sm:py-12">
          <h2 className="max-w-2xl font-display text-2xl leading-tight text-white sm:text-3xl">
            {DESTINATIONS.length} destinations to explore.{" "}
            <span className="text-gold-bright">
              {SUPPORTED_CITIES.length} with a human-checked set behind{" "}
              {SUPPORTED_CITIES.length === 1 ? "it" : "them"}.
            </span>
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/75">
            We&rsquo;d rather tell you which is which than pretend we know every city equally
            well. A destination becomes verified when a person has checked every recommendation
            in it — not when it gets added to a list.
          </p>
        </section>
      </main>

      <Footer />
    </>
  );
}
