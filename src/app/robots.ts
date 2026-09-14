import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    // Personal and shared trips are private; the API is not content.
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/trip", "/trips", "/account", "/join", "/offline", "/admin"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
