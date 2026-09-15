import type { MetadataRoute } from "next";

/**
 * Lets crawlers in and points them at the sitemap. There was no robots.txt at
 * all, so a search engine had nothing telling it which pages matter or where
 * to find them after a change.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: "https://finquanta.ai/sitemap.xml",
  };
}
