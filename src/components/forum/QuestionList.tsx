import Link from "next/link";
import { forumDate, regionLabel, repliesLabel, themeLabel, type ForumQuestion } from "@/lib/forum";

/** Approved questions as a list: the question, where and who, topics, and how many answers. */
export function QuestionList({ questions }: { questions: ForumQuestion[] }) {
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-paper-raised">
      {questions.map((question) => {
        const where = [question.place, regionLabel(question.region)].filter(Boolean).join(" · ");
        return (
          <li key={question.id}>
            <Link
              href={`/forum/questions/${question.id}`}
              className="group grid gap-3 px-5 py-4 transition hover:bg-paper sm:grid-cols-[1fr_auto] sm:items-center sm:px-6"
            >
              <span className="min-w-0">
                <span className="block text-balance text-[17px] font-semibold leading-snug text-ink group-hover:text-brand-deep">{question.title}</span>
                <span className="mt-1 block text-[13px] text-ink-faint">
                  {where} · Asked by {question.author_name} · {forumDate(question.created_at)}
                </span>
                {question.themes.length > 0 && (
                  <span className="mt-2 flex flex-wrap gap-1.5">
                    {question.themes.map((slug) => (
                      <span key={slug} className="rounded-full bg-paper-sunken px-2.5 py-0.5 text-xs text-ink-soft">
                        {themeLabel(slug)}
                      </span>
                    ))}
                  </span>
                )}
              </span>
              <span
                className={`justify-self-start whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold sm:justify-self-end ${
                  question.reply_count > 0 ? "bg-brand/10 text-brand-deep" : "bg-gold-bright/25 text-gold"
                }`}
              >
                {question.reply_count > 0 ? repliesLabel(question.reply_count) : "Be the first to answer"}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
