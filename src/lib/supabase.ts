import { createClient } from "@supabase/supabase-js";
import { cleanEnvValue } from "./env";

const url = cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL);
const key = cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

export const supabase = url && key ? createClient(url, key) : null;

/** Fired once the client exists in the browser, so the account state can attach without importing it. */
export const SUPABASE_READY_EVENT = "nativa:supabase-ready";

if (supabase && typeof window !== "undefined") {
  (window as Window & { __nativaSupabase?: typeof supabase }).__nativaSupabase = supabase;
  window.dispatchEvent(new Event(SUPABASE_READY_EVENT));
}
