import type { MetadataRoute } from "next";
import { env } from "@/lib/env";
import { routing, LOCALE_TAGS } from "@/i18n/routing";

/**
 * Sitemap with per-URL `alternates.languages`, so a crawler is told up front
 * that /ru and /kk are the same page in two languages rather than duplicate
 * content — which matters for a bilingual site whose audience searches in both.
 */
const PATHS = ["", "/privacy", "/terms"] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];

  for (const path of PATHS) {
    for (const locale of routing.locales) {
      entries.push({
        url: `${env.APP_URL}/${locale}${path}`,
        lastModified: new Date(),
        changeFrequency: path === "" ? "weekly" : "yearly",
        priority: path === "" ? 1 : 0.3,
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
