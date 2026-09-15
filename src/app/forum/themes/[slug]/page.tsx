import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ForumTopic } from "@/components/forum/ForumTopic";
import { FORUM_THEMES, themeBySlug } from "@/lib/forum";
import { publishedQuestions } from "@/lib/forum-server";
import { publishedStories } from "@/lib/stories-server";

export const revalidate = 300;
export const dynamicParams = false;

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return FORUM_THEMES.map((theme) => ({ slug: theme.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const theme = themeBySlug((await params).slug);
  if (!theme) return {};
  return {
    title: `${theme.label} — travel questions and stories | Nativa Forum`,
    description: `${theme.label}: questions from travellers, answers from people who've done it, and trips shared in their own words.`,
    alternates: { canonical: `/forum/themes/${theme.slug}` },
  };
}

export default async function ThemePage({ params }: Props) {
  const theme = themeBySlug((await params).slug);
  if (!theme) notFound();

  const [questions, stories] = await Promise.all([
    publishedQuestions({ theme: theme.slug, limit: 50 }),
    publishedStories({ theme: theme.slug, limit: 12 }),
  ]);

  return (
    <ForumTopic
      crumb="Themes"
      title={theme.label}
      blurb={`Questions and trips about ${theme.label.toLowerCase()}, anywhere in the world — from travellers who've done it.`}
      askHref={`/forum/ask?theme=${theme.slug}`}
      questions={questions}
      stories={stories}
    />
  );
}
