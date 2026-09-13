/**
 * Client monitoring. Both SDKs load only when their keys exist, so a deployment without them
 * ships none of their code. Initialisation is fire-and-forget so it never delays hydration.
 */

const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (posthogKey) {
  import("posthog-js")
    .then(({ default: posthog }) => {
      posthog.init(posthogKey, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
        defaults: "2025-05-24",
        person_profiles: "identified_only",
        // No session recordings of what people type about their trips.
        disable_session_recording: true,
      });
    })
    .catch(() => undefined);
}

if (sentryDsn) {
  import("@sentry/nextjs")
    .then((Sentry) => {
      Sentry.init({
        dsn: sentryDsn,
        tracesSampleRate: 0.1,
        sendDefaultPii: false,
      });
    })
    .catch(() => undefined);
}

export function onRouterTransitionStart(url: string, navigationType: "push" | "replace" | "traverse") {
  if (!sentryDsn) return;
  import("@sentry/nextjs")
    .then((Sentry) => Sentry.captureRouterTransitionStart(url, navigationType))
    .catch(() => undefined);
}
