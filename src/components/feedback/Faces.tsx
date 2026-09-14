/** Five drawn faces for "how does Nativa feel", from frustrating to love it. */

export const FEELINGS = [
  { value: 1, label: "Frustrating" },
  { value: 2, label: "Not great" },
  { value: 3, label: "Okay" },
  { value: 4, label: "Good" },
  { value: 5, label: "Love it" },
] as const;

export function FeelingFace({ value, className = "h-6 w-6" }: { value: number; className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round">
      <circle cx="12" cy="12" r="9.5" />
      {value === 5 ? (
        <>
          <path d="M7.6 10.3c.6-1.1 2-1.1 2.6 0M13.8 10.3c.6-1.1 2-1.1 2.6 0" strokeWidth={1.6} />
          <path d="M7.6 13.6h8.8c-.4 2.6-2.2 4.2-4.4 4.2s-4-1.6-4.4-4.2Z" fill="currentColor" stroke="none" />
        </>
      ) : (
        <>
          <circle cx="8.8" cy="10" r="1.1" fill="currentColor" stroke="none" />
          <circle cx="15.2" cy="10" r="1.1" fill="currentColor" stroke="none" />
          {value === 1 && <path d="M8.3 16.4c2.3-2 5.1-2 7.4 0" />}
          {value === 2 && <path d="M8.8 15.6c2-1 4.4-1 6.4 0" />}
          {value === 3 && <path d="M8.5 15.3h7" />}
          {value === 4 && <path d="M8.3 15c2.3 2 5.1 2 7.4 0" />}
        </>
      )}
    </svg>
  );
}
