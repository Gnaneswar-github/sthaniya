import type { ForumQuestion, ForumReply } from "./forum";
import { anyColumnLike, publicSupabase } from "./supabase-public";

/** Server-side reads of approved forum posts only, through the public views. */

const QUESTION_COLUMNS = "id, created_at, region, themes, place, title, body, author_name, reply_count, last_reply_at";
const UUID = /^[0-9a-f-]{36}$/i;

export async function publishedQuestions(
  options: { region?: string; theme?: string; search?: string; limit?: number } = {},
): Promise<ForumQuestion[]> {
  const supabase = publicSupabase();
  if (!supabase) return [];
  let query = supabase.from("published_questions").select(QUESTION_COLUMNS).order("created_at", { ascending: false }).limit(options.limit ?? 30);
  if (options.region) query = query.eq("region", options.region);
  if (options.theme) query = query.contains("themes", [options.theme]);
  if (options.search) query = query.or(anyColumnLike(options.search, ["title", "body", "place"]));
  const { data, error } = await query;
  return error || !data ? [] : (data as ForumQuestion[]);
}

export async function publishedQuestion(id: string): Promise<ForumQuestion | null> {
  if (!UUID.test(id)) return null;
  const supabase = publicSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.from("published_questions").select(QUESTION_COLUMNS).eq("id", id).maybeSingle();
  return error || !data ? null : (data as ForumQuestion);
}

export async function publishedReplies(questionId: string): Promise<ForumReply[]> {
  if (!UUID.test(questionId)) return [];
  const supabase = publicSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("published_replies")
    .select("id, created_at, question_id, body, been_there, author_name")
    .eq("question_id", questionId)
    .order("created_at", { ascending: true })
    .limit(200);
  return error || !data ? [] : (data as ForumReply[]);
}

/** How many approved questions and stories sit under each region and theme. */
export async function forumTallies(): Promise<{ regions: Record<string, number>; themes: Record<string, number> }> {
  const tallies = { regions: {} as Record<string, number>, themes: {} as Record<string, number> };
  const supabase = publicSupabase();
  if (!supabase) return tallies;
  const [questions, stories] = await Promise.all([
    supabase.from("published_questions").select("region, themes").limit(5000),
    supabase.from("published_stories").select("region, themes").limit(5000),
  ]);
  for (const row of [...(questions.data ?? []), ...(stories.data ?? [])] as { region: string | null; themes: string[] | null }[]) {
    if (row.region) tallies.regions[row.region] = (tallies.regions[row.region] ?? 0) + 1;
    for (const theme of row.themes ?? []) tallies.themes[theme] = (tallies.themes[theme] ?? 0) + 1;
  }
  return tallies;
}
