import type { MetadataRoute } from "next";

const SITE = "https://finquanta.ai";

/**
 * The public marketing pages, so search engines find them and notice when they
 * change. The app and the admin panel sit behind sign-in and are left out.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const pages: { path: string; priority: number; changeFrequency: "weekly" | "monthly" }[] = [
    { path: "/home", priority: 1, changeFrequency: "weekly" },
    { path: "/pricing", priority: 0.8, changeFrequency: "monthly" },
    { path: "/blog", priority: 0.6, changeFrequency: "weekly" },
    { path: "/terms", priority: 0.3, changeFrequency: "monthly" },
    { path: "/privacy", priority: 0.3, changeFrequency: "monthly" },
    { path: "/ai-risk-disclosure", priority: 0.3, changeFrequency: "monthly" },
  ];
  return pages.map(({ path, priority, changeFrequency }) => ({
    url: `${SITE}${path}`,
    changeFrequency,
    priority,
  }));
}
