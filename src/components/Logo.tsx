/** A leaf that reads as a paper plane — local ground, travel. Drawn, not imported. */
export function Mark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden focusable="false">
      <path
        d="M28 4C16.5 4.8 9.2 8.6 6.2 14.6c-2.1 4.2-1.5 8.6.7 11.2l3.3-3.3c-.9-1.6-1-3.9.2-6.3 2.1-4.2 7.4-7.1 15.6-8.2-6 4.6-10.6 7.6-14 9.6-1.1.7-1.5 2-1 3.1l1 2.1c5.6-1.3 10.1-4.2 13.2-8.4C28.5 10 28.9 6.6 28 4Z"
        fill="currentColor"
      />
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
      <span className={textClassName}>Nativa</span>
    </span>
  );
}
