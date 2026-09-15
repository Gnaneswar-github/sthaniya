/** Shared shapes and limits for traveller stories. */

export const STORY_BUCKET = "story-photos";

export const STORY_LIMITS = { photos: 6, places: 12, title: 120, body: 4000, bodyMin: 20, name: 60, place: 120 } as const;

export const PLACE_KINDS = [
  { id: "stay", label: "Stay" },
  { id: "food", label: "Food" },
  { id: "spot", label: "Spot" },
] as const;

export type PlaceKind = (typeof PLACE_KINDS)[number]["id"];
export type StoryPlace = { kind: PlaceKind; name: string };
export type StoryRealm = "earth" | "beyond";

export type PublishedStory = {
  id: string;
  created_at: string;
  realm: StoryRealm;
  place: string;
  travelled_on: string | null;
  title: string;
  body: string;
  places: StoryPlace[];
  photos: string[];
  author_name: string;
  /** Forum region slug, when the author picked one. */
  region: string | null;
  /** Forum theme slugs. */
  themes: string[];
  /** Signed links for the photos, in order. */
  photoUrls: string[];
};

export const placeKindLabel = (kind: string) => PLACE_KINDS.find((k) => k.id === kind)?.label ?? "Place";
