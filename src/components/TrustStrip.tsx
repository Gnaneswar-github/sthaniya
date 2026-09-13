/**
 * Four claims we can actually stand behind. Deliberately no "10,000 happy travellers" —
 * we have no users yet, and inventing a number here would undercut the whole premise.
 */
const POINTS = [
  {
    title: "Checked by a person",
    body: "A city goes live only once someone has verified every recommendation in it.",
    icon: CompassIcon,
  },
  {
    title: "Hidden gems",
    body: "Places you'd need a friend in the city to hear about.",
    icon: MapIcon,
  },
  {
    title: "Any length of trip",
    body: "One free afternoon or a slow week — the plan fits the time you have.",
    icon: ClockIcon,
  },
  {
    title: "Yours to edit",
    body: "Swap, remove or reorder anything. It's a plan, not a verdict.",
    icon: HeartIcon,
  },
];

export function TrustStrip() {
  return (
    <section className="border-b border-line bg-paper">
      <ul className="mx-auto grid w-full max-w-6xl gap-x-6 gap-y-7 px-5 py-9 sm:grid-cols-2 lg:grid-cols-4">
        {POINTS.map(({ title, body, icon: Icon }) => (
          <li key={title} className="flex gap-3">
            <span className="mt-0.5 shrink-0 text-brand">
              <Icon />
            </span>
            <span>
              <span className="block text-sm font-semibold text-ink">{title}</span>
              <span className="mt-0.5 block text-sm leading-relaxed text-ink-soft">{body}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function CompassIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden {...stroke}>
      <circle cx="12" cy="12" r="9" />
      <path d="m15.2 8.8-2 4.4-4.4 2 2-4.4Z" />
    </svg>
  );
}

function MapIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden {...stroke}>
      <path d="m9 4 6 2 5-2v14l-5 2-6-2-5 2V6Z" />
      <path d="M9 4v14M15 6v14" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden {...stroke}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5.2l3.2 2" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden {...stroke}>
      <path d="M12 20s-7.2-4.5-7.2-9.4A4 4 0 0 1 12 8.2a4 4 0 0 1 7.2 2.4C19.2 15.5 12 20 12 20Z" />
    </svg>
  );
}
