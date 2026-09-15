import type { MetadataRoute } from "next";
import { FORUM_REGIONS, FORUM_THEMES } from "@/lib/forum";
import { GUIDES } from "@/lib/guides";
import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: SITE_URL, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/destinations`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}/forum`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/stories`, lastModified: now, changeFrequency: "daily", priority: 0.7 },
    ...FORUM_REGIONS.map((region) => ({ url: `${SITE_URL}/forum/regions/${region.slug}`, lastModified: now, changeFrequency: "daily" as const, priority: 0.6 })),
    ...FORUM_THEMES.map((theme) => ({ url: `${SITE_URL}/forum/themes/${theme.slug}`, lastModified: now, changeFrequency: "daily" as const, priority: 0.6 })),
    ...GUIDES.map((guide) => ({
      url: `${SITE_URL}/destinations/${guide.slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}
