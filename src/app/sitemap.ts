import type { MetadataRoute } from "next";
import { communitySections } from "@/lib/community";
import { FORUM_REGIONS, FORUM_THEMES } from "@/lib/forum";
import { GUIDES } from "@/lib/guides";
import { SITE_URL } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  // Empty community pages stay out of search until they have something in them.
  const sections = await communitySections();

  return [
    { url: SITE_URL, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/destinations`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    ...(sections.forum
      ? [
          { url: `${SITE_URL}/forum`, lastModified: now, changeFrequency: "daily" as const, priority: 0.8 },
          ...FORUM_REGIONS.map((region) => ({ url: `${SITE_URL}/forum/regions/${region.slug}`, lastModified: now, changeFrequency: "daily" as const, priority: 0.6 })),
          ...FORUM_THEMES.map((theme) => ({ url: `${SITE_URL}/forum/themes/${theme.slug}`, lastModified: now, changeFrequency: "daily" as const, priority: 0.6 })),
        ]
      : []),
    ...(sections.stories ? [{ url: `${SITE_URL}/stories`, lastModified: now, changeFrequency: "daily" as const, priority: 0.7 }] : []),
    ...GUIDES.map((guide) => ({
      url: `${SITE_URL}/destinations/${guide.slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}
