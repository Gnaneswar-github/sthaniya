/**
 * Product analytics, only when a PostHog key is configured. Without one this is a no-op and the
 * SDK is never downloaded. Events describe what people do with trips, never who they are:
 * no free text, no emails, no exact locations.
 */
export function track(event: string, properties?: Record<string, string | number | boolean | null>) {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY || typeof window === "undefined") return;
  import("posthog-js")
    .then(({ default: posthog }) => {
      if (posthog.__loaded) posthog.capture(event, properties);
    })
    .catch(() => undefined);
}
