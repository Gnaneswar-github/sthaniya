import type { SupabaseClient } from "@supabase/supabase-js";
import { STORY_BUCKET, type PublishedStory, type StoryRealm } from "./stories";
import { anyColumnLike, publicSupabase } from "./supabase-public";

/** Server-side reads of approved stories only, through the public view. */

const COLUMNS = "id, created_at, realm, place, travelled_on, title, body, places, photos, author_name, region, themes";
const SIGNED_FOR_SECONDS = 7 * 24 * 60 * 60;

type Row = Omit<PublishedStory, "photoUrls">;

async function withPhotoUrls(supabase: SupabaseClient, rows: Row[]): Promise<PublishedStory[]> {
  const paths = rows.flatMap((row) => row.photos ?? []);
  if (paths.length === 0) return rows.map((row) => ({ ...row, themes: row.themes ?? [], photoUrls: [] }));
  const { data } = await supabase.storage.from(STORY_BUCKET).createSignedUrls(paths, SIGNED_FOR_SECONDS);
  const urls = new Map((data ?? []).filter((d) => d.signedUrl && d.path).map((d) => [d.path as string, d.signedUrl]));
  return rows.map((row) => ({
    ...row,
    themes: row.themes ?? [],
    photoUrls: (row.photos ?? []).map((path) => urls.get(path)).filter((u): u is string => Boolean(u)),
  }));
}

export async function publishedStories(
  options: { place?: string; realm?: StoryRealm; region?: string; theme?: string; search?: string; limit?: number } = {},
): Promise<PublishedStory[]> {
  const supabase = publicSupabase();
  if (!supabase) return [];
  let query = supabase.from("published_stories").select(COLUMNS).order("created_at", { ascending: false }).limit(options.limit ?? 60);
  if (options.place) query = query.ilike("place", `%${options.place.replace(/[%_]/g, "")}%`);
  if (options.realm) query = query.eq("realm", options.realm);
  if (options.region) query = query.eq("region", options.region);
  if (options.theme) query = query.contains("themes", [options.theme]);
  if (options.search) query = query.or(anyColumnLike(options.search, ["title", "body", "place"]));
  const { data, error } = await query;
  if (error || !data) return [];
  return withPhotoUrls(supabase, data as Row[]);
}

export async function publishedStory(id: string): Promise<PublishedStory | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = publicSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.from("published_stories").select(COLUMNS).eq("id", id).maybeSingle();
  if (error || !data) return null;
  const [story] = await withPhotoUrls(supabase, [data as Row]);
  return story ?? null;
}
