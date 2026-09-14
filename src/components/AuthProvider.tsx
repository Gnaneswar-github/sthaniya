"use client";

import type { User } from "@supabase/supabase-js";
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

const AuthContext = createContext<AuthState>({ user: null, ready: false, available: configured });

/**
 * Reads the session without putting the Supabase client in the page's start-up bundle: the SDK is
 * a quarter of a megabyte of script, and evaluating it during hydration showed up as part of the
 * homepage's first long task. It loads once the browser is idle instead.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, ready: !configured, available: configured });

  useEffect(() => {
    if (!configured) return;
    let live = true;
    let unsubscribe: (() => void) | undefined;

    const start = () =>
      import("@/lib/supabase").then(({ supabase }) => {
        if (!live || !supabase) return;
        supabase.auth.getSession().then(({ data }) => {
          if (live) setState({ user: data.session?.user ?? null, ready: true, available: true });
        });
        const { data } = supabase.auth.onAuthStateChange((_event, session) => {
          if (live) setState({ user: session?.user ?? null, ready: true, available: true });
        });
        unsubscribe = () => data.subscription.unsubscribe();
      });

    const idle = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    if (idle) idle(() => void start(), { timeout: 2000 });
    else window.setTimeout(() => void start(), 800);

    return () => {
      live = false;
      unsubscribe?.();
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
