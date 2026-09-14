/**
 * The Lotus Compass: eight petals that read as a lotus in India and a compass rose everywhere
 * else — rooted, and finding your way. The cardinal petals take the current text colour, the
 * diagonal petals a softer tint of it, and the centre is the sunrise gold, so one mark works on
 * paper and on the dark hero alike. Drawn, not imported.
 */
export function Mark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden focusable="false">
      <g fill="currentColor">
        <path d="M32 4c5 7 5 17 0 24-5-7-5-17 0-24Z" />
        <path d="M32 60c-5-7-5-17 0-24 5 7 5 17 0 24Z" />
        <path d="M4 32c7-5 17-5 24 0-7 5-17 5-24 0Z" />
        <path d="M60 32c-7 5-17 5-24 0 7-5 17-5 24 0Z" />
      </g>
      <g fill="currentColor" opacity="0.6">
        <path d="M12.2 12.2c8.4 1.6 14.2 7.4 15.8 15.8-8.4-1.6-14.2-7.4-15.8-15.8Z" />
        <path d="M51.8 51.8c-8.4-1.6-14.2-7.4-15.8-15.8 8.4 1.6 14.2 7.4 15.8 15.8Z" />
        <path d="M51.8 12.2c-1.6 8.4-7.4 14.2-15.8 15.8 1.6-8.4 7.4-14.2 15.8-15.8Z" />
        <path d="M12.2 51.8c1.6-8.4 7.4-14.2 15.8-15.8-1.6 8.4-7.4 14.2-15.8 15.8Z" />
      </g>
      <circle cx="32" cy="32" r="4.5" fill="#f5c164" />
    </svg>
  );
}

export function Wordmark({
  className = "",
  markClassName = "h-7 w-7 text-brand-bright",
  textClassName = "font-display text-xl tracking-tight",
}: {
  className?: string;
  markClassName?: string;
  textClassName?: string;
}) {
  return (
    <span className={`flex items-center gap-2 ${className}`}>
      <Mark className={markClassName} />
      <span className={textClassName}>nativa</span>
    </span>
  );
}
