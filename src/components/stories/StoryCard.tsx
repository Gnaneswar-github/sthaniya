import Link from "next/link";
import { placeKindLabel, type PublishedStory } from "@/lib/stories";

/** An approved story as a card: first photo, who and when, title, a taste of the story, places. */
export function StoryCard({ story }: { story: PublishedStory }) {
  const extra = story.photoUrls.length - 1;

  return (
    <article className="lift h-full overflow-hidden rounded-3xl border border-line bg-paper-raised">
      <Link href={`/stories/${story.id}`} className="flex h-full flex-col">
        {story.photoUrls[0] && (
          <div className="relative aspect-[4/3] bg-paper-sunken">
            {/* eslint-disable-next-line @next/next/no-img-element -- signed, already-resized upload; the image optimiser can't fetch private links. */}
            <img src={story.photoUrls[0]} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
            {extra > 0 && (
              <span className="absolute bottom-3 right-3 rounded-full bg-deep/80 px-2.5 py-1 text-xs font-semibold text-white">
                +{extra} photo{extra === 1 ? "" : "s"}
              </span>
            )}
          </div>
        )}
        <div className="flex flex-1 flex-col gap-2 p-5">
          <p className="flex items-center gap-2 text-[13px] text-ink-soft">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-brand text-xs font-semibold uppercase text-white">
              {story.author_name.charAt(0)}
            </span>
            <span className="font-semibold text-ink">{story.author_name}</span>
            {story.travelled_on && <span>· {story.travelled_on}</span>}
          </p>
          <p className="text-xs text-ink-faint">{story.realm === "beyond" ? `Beyond · ${story.place}` : story.place}</p>
          <h3 className="text-balance font-display text-xl leading-tight text-ink">{story.title}</h3>
          <p className="line-clamp-3 flex-1 text-sm leading-relaxed text-ink-soft">{story.body}</p>
          {story.places.length > 0 && (
            <ul className="flex flex-wrap gap-1.5 pt-1">
              {story.places.slice(0, 3).map((place) => (
                <li key={`${place.kind}-${place.name}`} className="rounded-full border border-line bg-paper px-2.5 py-1 text-xs text-ink-soft">
                  {placeKindLabel(place.kind)} · <span className="font-semibold text-ink">{place.name}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Link>
    </article>
  );
}
