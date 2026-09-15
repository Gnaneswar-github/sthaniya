import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ForumTopic } from "@/components/forum/ForumTopic";
import { FORUM_REGIONS, regionBySlug } from "@/lib/forum";
import { publishedQuestions } from "@/lib/forum-server";
import { publishedStories } from "@/lib/stories-server";

export const revalidate = 300;
export const dynamicParams = false;

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return FORUM_REGIONS.map((region) => ({ slug: region.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const region = regionBySlug((await params).slug);
  if (!region) return {};
  return {
    title: `${region.label} travel forum — questions and traveller stories | Nativa`,
    description: `Ask travellers about ${region.label}, answer from experience, and read trips shared by people who've been.`,
    alternates: { canonical: `/forum/regions/${region.slug}` },
  };
}

export default async function RegionPage({ params }: Props) {
  const region = regionBySlug((await params).slug);
  if (!region) notFound();

  const [questions, stories] = await Promise.all([
    publishedQuestions({ region: region.slug, limit: 50 }),
    publishedStories({ region: region.slug, limit: 12 }),
  ]);

  return (
    <ForumTopic
      crumb="Destinations"
      title={region.label}
      blurb={
        region.slug === "beyond"
          ? "Space flights, auroras, eclipses and the nights that didn't feel like this planet — ask about them, or share yours."
          : `Questions from travellers heading to ${region.label}, answered by people who've been, and trips shared in their own words.`
      }
      askHref={`/forum/ask?region=${region.slug}`}
      questions={questions}
      stories={stories}
    />
  );
}
