/** Shared vocabulary, shapes and limits for the Nativa forum. Keep the slugs in step with migration 005. */

export const FORUM_REGIONS = [
  { slug: "asia", label: "Asia" },
  { slug: "europe", label: "Europe" },
  { slug: "africa", label: "Africa" },
  { slug: "middle-east", label: "Middle East" },
  { slug: "north-america", label: "North America" },
  { slug: "latin-america", label: "Central & South America" },
  { slug: "caribbean", label: "Caribbean" },
  { slug: "oceania", label: "Oceania & the Pacific" },
  { slug: "beyond", label: "Out of this world" },
] as const;

export const FORUM_THEMES = [
  { slug: "solo", label: "Solo travel" },
  { slug: "couples", label: "Honeymoons & romance" },
  { slug: "family", label: "Family travel" },
  { slug: "food", label: "Food & local markets" },
  { slug: "budget", label: "Budget travel" },
  { slug: "trains", label: "Trains & road trips" },
  { slug: "outdoors", label: "Outdoors & adventure" },
  { slug: "culture", label: "Culture & heritage" },
  { slug: "pets", label: "Travelling with pets" },
  { slug: "accessible", label: "Accessible travel" },
  { slug: "first-trip", label: "First trip abroad" },
  { slug: "gear", label: "Packing & gear" },
] as const;

export type RegionSlug = (typeof FORUM_REGIONS)[number]["slug"];
export type ThemeSlug = (typeof FORUM_THEMES)[number]["slug"];

export const FORUM_LIMITS = { titleMin: 8, title: 160, details: 3000, replyMin: 2, reply: 3000, name: 60, place: 120, themes: 3 } as const;

export type ForumQuestion = {
  id: string;
  created_at: string;
  region: string;
  themes: string[];
  place: string | null;
  title: string;
  body: string;
  author_name: string;
  reply_count: number;
  last_reply_at: string | null;
};

export type ForumReply = {
  id: string;
  created_at: string;
  question_id: string;
  body: string;
  been_there: boolean;
  author_name: string;
};

export const regionBySlug = (slug: string | null | undefined) => FORUM_REGIONS.find((region) => region.slug === slug);
export const themeBySlug = (slug: string | null | undefined) => FORUM_THEMES.find((theme) => theme.slug === slug);
export const regionLabel = (slug: string | null | undefined) => regionBySlug(slug)?.label ?? null;
export const themeLabel = (slug: string | null | undefined) => themeBySlug(slug)?.label ?? null;

const DATE = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
export const forumDate = (iso: string) => DATE.format(new Date(iso));

export const repliesLabel = (count: number) => (count === 1 ? "1 reply" : `${count} replies`);
