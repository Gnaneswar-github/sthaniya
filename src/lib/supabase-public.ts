import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cleanEnvValue } from "./env";

/** A server-side client with the public key and no session: it can only read what the public views expose. */
export function publicSupabase(): SupabaseClient | null {
  const url = cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key = cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  return url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
}

/**
 * Letters (with their combining marks, which Hindi, Arabic and Thai need), numbers, spaces, apostrophes
 * and hyphens only, so a search can't break out of the filter syntax.
 */
export function cleanSearchTerm(raw: string | null | undefined): string {
  return (raw ?? "")
    .replace(/[^\p{L}\p{M}\p{N}\s'-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

/** A PostgREST `or` filter matching the (already cleaned) term anywhere in any of the columns. */
export const anyColumnLike = (term: string, columns: string[]) => columns.map((column) => `${column}.ilike."%${term}%"`).join(",");
