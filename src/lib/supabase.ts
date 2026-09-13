import { createClient } from "@supabase/supabase-js";
import { cleanEnvValue } from "./env";

const url = cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL);
const key = cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

export const supabase = url && key ? createClient(url, key) : null;
