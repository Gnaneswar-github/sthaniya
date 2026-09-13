"use client";

import type { User } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";

type AuthState = {
  user: User | null;
  /** False until the stored session has been read, so pages don't flash "signed out". */
  ready: boolean;
  /** False when no Supabase project is configured — account features hide themselves. */
  available: boolean;
};

const AuthContext = createContext<AuthState>({ user: null, ready: false, available: false });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, ready: !supabase, available: Boolean(supabase) });

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setState({ user: data.session?.user ?? null, ready: true, available: true });
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ user: session?.user ?? null, ready: true, available: true });
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

export function displayNameOf(user: User | null): string {
  if (!user) return "";
  const fromMeta = (user.user_metadata as { display_name?: string } | undefined)?.display_name;
  return fromMeta || user.email?.split("@")[0] || "Traveller";
}
