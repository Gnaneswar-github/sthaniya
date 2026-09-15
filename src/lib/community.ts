import { cleanEnvValue } from "./env";

/**
 * Whether the forum and traveller stories show in navigation and teasers. An empty community
 * section makes a young site look abandoned, so each stays out of sight until it has enough
 * approved posts — the routes keep working throughout, for the admin and for direct links.
 *
 * Set NEXT_PUBLIC_SHOW_FORUM / NEXT_PUBLIC_SHOW_STORIES to "1" or "0" to force either way, and
 * COMMUNITY_MIN_POSTS to change the threshold (10 by default). No code or data is removed.
 */

export type CommunitySections = { forum: boolean; stories: boolean };

const flag = (value: string | undefined): boolean | null => {
  const v = cleanEnvValue(value)?.toLowerCase();
  if (v === "1" || v === "true" || v === "on") return true;
  if (v === "0" || v === "false" || v === "off") return false;
  return null;
};

/** Approved rows in a public view, counted without fetching them. Cached for ten minutes. */
async function approvedCount(view: string): Promise<number> {
  const url = cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key = cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  if (!url || !key) return 0;
  try {
    const response = await fetch(`${url}/rest/v1/${view}?select=id`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: "count=exact", Range: "0-0" },
      next: { revalidate: 600 },
      signal: AbortSignal.timeout(4000),
    });
    const total = Number(response.headers.get("content-range")?.split("/")[1]);
    return Number.isFinite(total) ? total : 0;
  } catch {
    return 0;
  }
}

export async function communitySections(): Promise<CommunitySections> {
  const threshold = Number(cleanEnvValue(process.env.COMMUNITY_MIN_POSTS)) || 10;
  const forumFlag = flag(process.env.NEXT_PUBLIC_SHOW_FORUM);
  const storiesFlag = flag(process.env.NEXT_PUBLIC_SHOW_STORIES);
  if (forumFlag !== null && storiesFlag !== null) return { forum: forumFlag, stories: storiesFlag };

  const [questions, stories] = await Promise.all([forumFlag === null ? approvedCount("published_questions") : 0, approvedCount("published_stories")]);
  return {
    // The forum hub shows both questions and stories, so either kind of post counts toward it.
    forum: forumFlag ?? questions + stories >= threshold,
    stories: storiesFlag ?? stories >= threshold,
  };
}
