import Link from "next/link";

const LINKS = [
  { href: "/admin/feedback", label: "Feedback" },
  { href: "/admin/stories", label: "Stories" },
  { href: "/admin/forum", label: "Forum" },
];

/** Switch between the admin review pages. */
export function AdminNav({ current }: { current: string }) {
  return (
    <nav aria-label="Admin pages" className="flex flex-wrap gap-1.5">
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          aria-current={link.href === current ? "page" : undefined}
          className={`rounded-full border px-3.5 py-1.5 text-sm transition ${
            link.href === current ? "border-deep bg-deep text-white" : "border-line bg-paper-raised text-ink-soft hover:border-brand hover:text-brand"
          }`}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
