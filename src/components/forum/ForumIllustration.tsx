/** Three overlapping conversation bubbles — a place, a chat, a journey — in the Nativa palette. */
export function ForumIllustration({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 284 124" className={className}>
      {/* Chat, at the back */}
      <rect x="92" y="4" width="112" height="68" rx="34" fill="#f5c164" />
      <path d="M168 66l18 22-34-14z" fill="#f5c164" />
      <circle cx="126" cy="38" r="5.5" fill="#0d2f42" />
      <circle cx="148" cy="38" r="5.5" fill="#0d2f42" />
      <circle cx="170" cy="38" r="5.5" fill="#0d2f42" />

      {/* A place */}
      <rect x="4" y="36" width="118" height="68" rx="34" fill="#15795a" />
      <path d="M38 98l-10 22 28-16z" fill="#15795a" />
      <path d="M63 53c-7.7 0-13 5.6-13 12.6C50 75 63 86 63 86s13-11 13-20.4C76 58.6 70.7 53 63 53Z" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinejoin="round" />
      <circle cx="63" cy="65.5" r="4" fill="#fff" />

      {/* A journey */}
      <rect x="164" y="46" width="116" height="68" rx="34" fill="#0d2f42" />
      <path d="M250 108l12 16-30-12z" fill="#0d2f42" />
      <path d="M200 82l40-16-13 32-8-11z" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinejoin="round" />
      <path d="M219 87l21-21" stroke="#f5c164" strokeWidth="3.2" strokeLinecap="round" />
    </svg>
  );
}
