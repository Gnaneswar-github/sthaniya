import type { MetadataRoute } from "next";
import { GUIDES } from "@/lib/guides";
import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: SITE_URL, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/destinations`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}/stories`, lastModified: now, changeFrequency: "daily", priority: 0.7 },
    ...GUIDES.map((guide) => ({
      url: `${SITE_URL}/destinations/${guide.slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}
