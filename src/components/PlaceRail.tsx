import Image from "next/image";
import Link from "next/link";
import { placeLocalScore } from "@/lib/trip-engine";
import { CATEGORIES, LOCALITY_TAGS, PRICE_BANDS, type Recommendation } from "@/lib/types";

/**
 * Rails built from the verified editorial set. Everything shown here is a real place a human
 * has written about, which is why these carry vibe and voice — unlike sourced destinations.
 */
export function PlaceRail({
  title,
  blurb,
  places,
}: {
  title: string;
  blurb: string;
  places: Recommendation[];
}) {
  if (places.length === 0) return null;

  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-display text-2xl text-ink sm:text-3xl">{title}</h2>
        <p className="text-sm text-ink-soft">{blurb}</p>
      </div>

      <div className="edge-fade -mx-5 px-5 sm:mx-0 sm:px-0">
        <ul className="rail flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2">
          {places.map((place) => (
            <li key={place.id} className="w-56 shrink-0 snap-start sm:w-64">
              <Link
                href={`/plan?q=${encodeURIComponent(
                  `${place.interests[0]?.replace("_", " ") ?? "local"} in ${place.destination}`,
                )}`}
                className="lift block overflow-hidden rounded-2xl border border-line bg-paper-raised"
              >
                <div className="relative aspect-[5/4]">
                  {place.photo ? (
                    <Image
                      src={place.photo.url}
                      alt={place.name}
                      fill
                      sizes="(max-width: 640px) 55vw, 256px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="h-full bg-gradient-to-br from-moss/80 to-moss/35" aria-hidden />
                  )}
                  <span className="absolute left-2 top-2 rounded-full bg-paper-raised/95 px-2 py-0.5 text-[10px] font-semibold text-ink-soft">
                    {LOCALITY_TAGS[place.tag]}
                  </span>
                </div>

                <div className="space-y-1 p-3.5">
                  <h3 className="font-display text-lg leading-tight text-ink">{place.name}</h3>
                  <p className="text-xs text-ink-faint">{place.vibe}</p>
                  <p className="line-clamp-2 text-sm leading-relaxed text-ink-soft">
                    {place.description}
                  </p>
                  <p className="pt-0.5 text-[11px] text-ink-faint">
                    {CATEGORIES[place.category]} · {PRICE_BANDS[place.priceBand].approxInr === 0 ? "Free" : PRICE_BANDS[place.priceBand].label} ·{" "}
                    {placeLocalScore(place)} local
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
