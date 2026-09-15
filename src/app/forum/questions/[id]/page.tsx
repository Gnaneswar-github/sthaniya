import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReplyForm } from "@/components/forum/ReplyForm";
import { Footer, Nav } from "@/components/Shell";
import { forumDate, regionBySlug, repliesLabel, themeLabel } from "@/lib/forum";
import { publishedQuestion, publishedReplies } from "@/lib/forum-server";

export const revalidate = 300;

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const question = await publishedQuestion((await params).id);
  if (!question) return { title: "Question not found — Nativa Forum" };
  return {
    title: `${question.title} | Nativa Forum`,
    description: (question.body || `A traveller question about ${question.place ?? regionBySlug(question.region)?.label ?? "travel"}, answered by people who've been.`).slice(0, 155),
    alternates: { canonical: `/forum/questions/${question.id}` },
  };
}

function Paragraphs({ text, className }: { text: string; className: string }) {
  return (
    <div className={className}>
      {text
        .split(/\n{2,}/)
        .filter((part) => part.trim())
        .map((part, index) => (
          <p key={index} className="whitespace-pre-line break-words">
            {part}
          </p>
        ))}
    </div>
  );
}

export default async function QuestionPage({ params }: Props) {
  const { id } = await params;
  const [question, replies] = await Promise.all([publishedQuestion(id), publishedReplies(id)]);
  if (!question) notFound();
  const region = regionBySlug(question.region);

  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-8 px-5 py-10">
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-sm text-ink-soft">
          <Link href="/forum" className="hover:text-brand">
            Forum
          </Link>
          {region && (
            <>
              <span aria-hidden>›</span>
              <Link href={`/forum/regions/${region.slug}`} className="hover:text-brand">
                {region.label}
              </Link>
            </>
          )}
        </nav>

        <article className="space-y-4">
          <h1 className="text-balance font-display text-4xl leading-tight text-ink sm:text-[2.75rem]">{question.title}</h1>
          <p className="flex flex-wrap items-center gap-2 text-sm text-ink-soft">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-deep text-sm font-semibold uppercase text-white">{question.author_name.charAt(0)}</span>
            Asked by <span className="font-semibold text-ink">{question.author_name}</span>
            <span>· {forumDate(question.created_at)}</span>
            {question.place && <span>· {question.place}</span>}
          </p>
          {question.body && <Paragraphs text={question.body} className="max-w-prose space-y-4 text-[17px] leading-relaxed text-ink" />}
          {question.themes.length > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {question.themes.map((slug) => (
                <li key={slug}>
                  <Link href={`/forum/themes/${slug}`} className="rounded-full border border-line bg-paper-raised px-3 py-1 text-xs text-ink-soft transition hover:border-brand hover:text-brand">
                    {themeLabel(slug)}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </article>

        <section className="space-y-4" aria-labelledby="answers">
          <h2 id="answers" className="font-display text-2xl text-ink">
            {replies.length > 0 ? repliesLabel(replies.length) : "Answers"}
          </h2>
          {replies.length > 0 ? (
            <ol className="space-y-3">
              {replies.map((reply) => (
                <li key={reply.id} className="rounded-3xl border border-line bg-paper-raised p-5">
                  <p className="flex flex-wrap items-center gap-2 text-sm text-ink-soft">
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-brand text-sm font-semibold uppercase text-white">{reply.author_name.charAt(0)}</span>
                    <span className="font-semibold text-ink">{reply.author_name}</span>
                    {reply.been_there && <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-semibold text-brand-deep">Has been there</span>}
                    <span className="text-ink-faint">· {forumDate(reply.created_at)}</span>
                  </p>
                  <Paragraphs text={reply.body} className="mt-3 space-y-3 text-[15px] leading-relaxed text-ink" />
                </li>
              ))}
            </ol>
          ) : (
            <p className="rounded-3xl border border-dashed border-line-strong px-5 py-6 text-[15px] text-ink-soft">
              Been there, or planned something similar? Your answer could be the one that helps.
            </p>
          )}
          <ReplyForm questionId={question.id} />
        </section>

        {question.place && (
          <Link
            href={`/plan?q=${encodeURIComponent(`3 days in ${question.place}`)}`}
            className="inline-flex rounded-full border border-line px-5 py-2.5 text-sm font-semibold text-ink-soft transition hover:border-brand hover:text-brand"
          >
            Plan a trip to {question.place.split(",")[0]}
          </Link>
        )}
      </main>
      <Footer />
    </>
  );
}
