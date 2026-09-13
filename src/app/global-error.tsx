"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
    import("@sentry/nextjs")
      .then((Sentry) => Sentry.captureException(error))
      .catch(() => undefined);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f7f6f2", color: "#17222a" }}>
        <main style={{ maxWidth: 520, margin: "20vh auto", padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 28, marginBottom: 8 }}>Something went wrong</h1>
          <p style={{ color: "#4d5c66", marginBottom: 20 }}>Your saved trip is safe on this device. Let&rsquo;s try that again.</p>
          <button
            type="button"
            onClick={reset}
            style={{ border: 0, borderRadius: 9999, background: "#15795a", color: "#fff", padding: "12px 22px", fontWeight: 600, cursor: "pointer" }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
