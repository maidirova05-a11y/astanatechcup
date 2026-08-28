import type { MetadataRoute } from "next";
import { env } from "@/lib/env";
import { routing, LOCALE_TAGS } from "@/i18n/routing";

/**
 * Sitemap with per-URL `alternates.languages`, so a crawler is told up front
 * that /ru and /kk are the same page in two languages rather than duplicate
 * content — which matters for a bilingual site whose audience searches in both.
 */
const PATHS = ["", "/categories", "/results", "/privacy", "/terms"] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];

  for (const path of PATHS) {
    for (const locale of routing.locales) {
      entries.push({
        url: `${env.APP_URL}/${locale}${path}`,
        lastModified: new Date(),
        // The results page turns over during a championship and is stale
        // within the hour; the rules change when a rulebook is revised.
        changeFrequency:
          path === "/results" ? "hourly" : path === "" ? "weekly" : "yearly",
        priority: path === "" ? 1 : path === "/categories" ? 0.8 : path === "/results" ? 0.7 : 0.3,
        alternates: {
          languages: Object.fromEntries(
            routing.locales.map((l) => [LOCALE_TAGS[l], `${env.APP_URL}/${l}${path}`]),
          ),
        },
      });
    }
  }

  return entries;
}
