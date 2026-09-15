"use client";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { cleanEnvValue } from "@/lib/env";

type AuthState = {
  user: User | null;
  /** False until the stored session has been read, so pages don't flash "signed out". */
  ready: boolean;
  /** False when no Supabase project is configured — account features hide themselves. */
  available: boolean;
};

const configured = Boolean(
  cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL) && cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
);

/** Kept in step with SUPABASE_READY_EVENT in lib/supabase, which this file must not import. */
const READY_EVENT = "nativa:supabase-ready";

type SupabaseWindow = Window & {
  __nativaSupabase?: SupabaseClient;
  requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
};

/** Supabase keeps a signed-in session in localStorage under "sb-<project>-auth-token". */
function hasStoredSession(): boolean {
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const name = window.localStorage.key(i);
      if (name?.startsWith("sb-") && name.endsWith("-auth-token")) return true;
    }
  } catch {
    // Storage blocked: treat as signed out; signing in still loads the client.
  }
  return false;
}

const AuthContext = createContext<AuthState>({ user: null, ready: false, available: configured });

/**
 * Knows who is signed in without making every visitor download the Supabase SDK — a quarter of a
 * megabyte of script, measured as a 380 ms freeze on a slower phone. Someone with no stored session
 * is signed out, so nothing loads; the client is fetched on idle only when a session exists, and
 * picked up the moment any page (sign-in, trips, a form) loads it for its own use.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, ready: !configured, available: configured });

  useEffect(() => {
    if (!configured) return;
    const w = window as SupabaseWindow;
    let live = true;
    let unsubscribe: (() => void) | undefined;

    const attach = (supabase: SupabaseClient | null | undefined) => {
      if (!live || !supabase || unsubscribe) return;
      supabase.auth.getSession().then(({ data }) => {
        if (live) setState({ user: data.session?.user ?? null, ready: true, available: true });
      });
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        if (live) setState({ user: session?.user ?? null, ready: true, available: true });
      });
      unsubscribe = () => data.subscription.unsubscribe();
    };
    const onReady = () => attach(w.__nativaSupabase);
    window.addEventListener(READY_EVENT, onReady);

    if (w.__nativaSupabase) {
      attach(w.__nativaSupabase);
    } else if (hasStoredSession()) {
      const load = () => void import("@/lib/supabase").then(({ supabase }) => attach(supabase));
      if (w.requestIdleCallback) w.requestIdleCallback(load, { timeout: 2000 });
      else window.setTimeout(load, 800);
    } else {
      Promise.resolve().then(() => {
        if (live && !unsubscribe) setState({ user: null, ready: true, available: true });
      });
    }

    return () => {
      live = false;
      unsubscribe?.();
      window.removeEventListener(READY_EVENT, onReady);
    };
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

export function displayNameOf(user: User | null): string {
  if (!user) return "";
  const fromMeta = (user.user_metadata as { display_name?: string } | undefined)?.display_name;
  return fromMeta || user.email?.split("@")[0] || "Traveller";
}
