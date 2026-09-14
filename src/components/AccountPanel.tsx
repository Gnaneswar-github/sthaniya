"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { displayNameOf, useAuth } from "./AuthProvider";
import { track } from "@/lib/analytics";
import { supabase } from "@/lib/supabase";

type Mode = "signin" | "signup";

const labelClass = "text-sm font-medium text-ink-soft";
const fieldClass =
  "w-full rounded-2xl border border-line bg-paper px-4 py-3 text-[15px] text-ink outline-none transition placeholder:text-ink-faint focus:border-brand";

/**
 * Sign in, create an account, or get a one-time email link — and, once signed in, a name and a
 * way out. Passwords go straight to Supabase Auth; this app never sees or stores them.
 */
export function AccountPanel() {
  const { user, ready, available } = useAuth();
  const router = useRouter();
  const next = useSearchParams().get("next") || "/trips";
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  // Arriving back from an email link lands here signed in: carry on to where they were going.
  useEffect(() => {
    if (ready && user && next.startsWith("/") && next !== "/account") {
      const params = new URLSearchParams(window.location.search);
      if (params.has("next")) router.replace(next);
    }
  }, [ready, user, next, router]);

  if (!available) {
    return <p className="text-ink-soft">Accounts aren&rsquo;t switched on for this deployment yet.</p>;
  }
  if (!ready) return <p className="text-ink-faint">Checking your session…</p>;

  const redirectTo = () => `${window.location.origin}/account?next=${encodeURIComponent(next)}`;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setMessage(null);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: name.trim() || undefined }, emailRedirectTo: redirectTo() },
        });
        if (error) throw error;
        track("account_created");
        if (!data.session) {
          setMessage({ tone: "ok", text: `Almost there — we've sent a confirmation link to ${email}.` });
        } else {
          router.push(next);
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        track("signed_in", { method: "password" });
        router.push(next);
      }
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "That didn't work — try again?" });
    } finally {
      setBusy(false);
    }
  }

  async function emailLink() {
    if (!supabase || !email) {
      setMessage({ tone: "error", text: "Add your email above first, and we'll send the link there." });
      return;
    }
    setBusy(true);
    setMessage(null);
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo() } });
    setBusy(false);
    setMessage(error ? { tone: "error", text: error.message } : { tone: "ok", text: `Check ${email} — your sign-in link is on its way.` });
  }

  if (user) {
    return <SignedIn email={user.email ?? ""} initialName={displayNameOf(user)} onSignOut={() => router.refresh()} />;
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 rounded-full bg-paper-sunken p-1 text-sm font-semibold" role="group" aria-label="Account options">
        {(["signin", "signup"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => {
              setMode(option);
              setMessage(null);
            }}
            aria-pressed={mode === option}
            className={`rounded-full py-2.5 transition ${mode === option ? "bg-paper-raised text-ink shadow-sm" : "text-ink-soft hover:text-ink"}`}
          >
            {option === "signin" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="space-y-4">
        {mode === "signup" && (
          <label className="block space-y-1.5">
            <span className={labelClass}>Your name</span>
            <input className={fieldClass} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="What friends call you" />
          </label>
        )}
        <label className="block space-y-1.5">
          <span className={labelClass}>Email</span>
          <input className={fieldClass} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </label>
        <label className="block space-y-1.5">
          <span className="flex items-baseline justify-between gap-2">
            <span className={labelClass}>Password</span>
            {mode === "signup" && <span className="text-xs text-ink-faint">At least 8 characters</span>}
          </span>
          <input
            className={fieldClass}
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-full bg-brand px-5 py-3.5 font-semibold text-white transition enabled:hover:bg-brand-deep enabled:active:scale-[0.99] disabled:opacity-60"
        >
          {busy ? "One moment…" : mode === "signup" ? "Create my account" : "Sign in"}
        </button>
      </form>

      <div className="flex items-center gap-3 text-xs text-ink-faint">
        <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
      </div>

      <button
        type="button"
        onClick={emailLink}
        disabled={busy}
        className="w-full rounded-full border border-line bg-paper-raised px-5 py-3 text-sm font-semibold text-ink transition enabled:hover:border-brand enabled:hover:text-brand disabled:opacity-60"
      >
        Email me a one-time sign-in link
      </button>

      {message && (
        <p role="status" className={`rounded-2xl px-4 py-3 text-sm ${message.tone === "ok" ? "bg-brand/10 text-brand-deep" : "bg-danger/10 text-danger"}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}

function SignedIn({ email, initialName, onSignOut }: { email: string; initialName: string; onSignOut: () => void }) {
  const [name, setName] = useState(initialName);
  const [saved, setSaved] = useState(false);

  async function saveName() {
    if (!supabase) return;
    const trimmed = name.trim();
    const { data } = await supabase.auth.updateUser({ data: { display_name: trimmed } });
    if (data.user) await supabase.from("profiles").update({ display_name: trimmed }).eq("id", data.user.id);
    setSaved(true);
  }

  return (
    <div className="space-y-5">
      <div>
        <p className={labelClass}>Signed in as</p>
        <p className="text-lg text-ink">{email}</p>
      </div>
      <label className="block space-y-1.5">
        <span className={labelClass}>Name shown to people you plan with</span>
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setSaved(false);
            }}
            className={`${fieldClass} flex-1`}
          />
          <button type="button" onClick={saveName} className="rounded-full bg-ink px-5 text-sm font-semibold text-paper transition hover:bg-brand-deep">
            {saved ? "Saved" : "Save"}
          </button>
        </div>
      </label>
      <div className="flex flex-wrap gap-2">
        <Link href="/trips" className="rounded-full bg-brand px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-deep">
          My trips
        </Link>
        <button
          type="button"
          onClick={async () => {
            await supabase?.auth.signOut();
            onSignOut();
          }}
          className="rounded-full border border-line px-5 py-3 text-sm font-semibold text-ink-soft transition hover:border-brand hover:text-brand"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
