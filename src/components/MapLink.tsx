import type { ReactNode } from "react";
import { googleMapsUrl } from "@/lib/maps";

/**
 * A place name that opens the place in Google Maps. The pin appears on hover for pointer
 * devices and stays faintly visible on touch, where there is no hover to discover it.
 */
export function MapLink({
  name,
  near,
  className = "",
  children,
}: {
  name: string;
  near?: string | null;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <a
      href={googleMapsUrl(name, near)}
      target="_blank"
      rel="noopener noreferrer"
      title={`Open ${name} in Google Maps`}
      className={`group/map inline decoration-brand/50 decoration-1 underline-offset-4 transition-colors hover:text-brand hover:underline focus-visible:text-brand ${className}`}
    >
      {children ?? name}
      <span className="sr-only"> (opens in Google Maps)</span>
      <PinIcon className="ml-1.5 inline-block h-[0.7em] w-[0.7em] -translate-y-[0.05em] align-baseline text-brand opacity-50 transition-opacity group-hover/map:opacity-100 group-focus-visible/map:opacity-100 [@media(hover:hover)]:opacity-0" />
    </a>
  );
}

export function PinIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinejoin="round"
    >
      <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.6" />
    </svg>
  );
}
