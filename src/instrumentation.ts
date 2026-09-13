import type { Instrumentation } from "next";

/** Server error monitoring with Sentry, active only when a DSN is configured. */
const dsn = () => process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

export async function register() {
  if (!dsn()) return;
  if (process.env.NEXT_RUNTIME === "nodejs" || process.env.NEXT_RUNTIME === "edge") {
    const Sentry = await import("@sentry/nextjs");
    Sentry.init({ dsn: dsn(), tracesSampleRate: 0.1, sendDefaultPii: false });
  }
}

export const onRequestError: Instrumentation.onRequestError = async (...args) => {
  if (!dsn()) return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(...args);
};
