import type { MetadataRoute } from "next";
import { env } from "@/lib/env";
import { routing, LOCALE_TAGS } from "@/i18n/routing";
import { CATEGORIES } from "@/config/categories";

/**
 * Sitemap with per-URL `alternates.languages`, so a crawler is told up front
 * that /ru and /kk are the same page in two languages rather than duplicate
 * content — which matters for a bilingual site whose audience searches in both.
 */
/**
 * ONLY INDEXABLE PATHS BELONG HERE.
 *
 * /privacy and /terms used to be listed, and both pages export
 * `robots: { index: false }` — deliberately, since legal boilerplate has no
 * search value and can outrank real content. A sitemap is a request to index,
 * so listing them asked Google to index URLs the pages themselves refuse,
 * which Search Console reports back as "Submitted URL marked 'noindex'". Two
 * permanent errors on a property whose coverage report should stay readable.
 *
 * They are still crawlable and still linked from the footer; they are simply
 * not advertised. If either page ever becomes indexable, add it back here in
 * the same commit that removes its `robots` export.
 */
const PATHS = [
  "",
  "/categories",
  "/results",
  // One board per category. The class inside it is a query parameter, which a
  // crawler is right to ignore: every class of a category carries the same
  // rules and the same teams list, and the canonical URL on each board points
  // back here.
  ...CATEGORIES.map((category) => `/results/${category.id}` as const),
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];

  for (const path of PATHS) {
    for (const locale of routing.locales) {
      entries.push({
        url: `${env.APP_URL}/${locale}${path}`,
        lastModified: new Date(),
        // The results page turns over during a championship and is stale
        // within the hour; the rules change when a rulebook is revised.
        changeFrequency: path.startsWith("/results")
          ? "hourly"
          : path === ""
            ? "weekly"
            : "yearly",
        priority:
          path === ""
            ? 1
            : path === "/categories"
              ? 0.8
              : path === "/results"
                ? 0.7
                : 0.6,
        alternates: {
          languages: {
            ...Object.fromEntries(
              routing.locales.map((l) => [LOCALE_TAGS[l], `${env.APP_URL}/${l}${path}`]),
            ),
            /*
             * The fallback for a language we do not publish. Present on the
             * home page's <head> but missing from every sitemap entry, which
             * left a Turkish or Ukrainian visitor's locale unhandled: Google
             * then picks whichever version it crawled first. Naming the default
             * locale makes that deterministic.
             */
            "x-default": `${env.APP_URL}/${routing.defaultLocale}${path}`,
          },
        },
      });
    }
  }

  return entries;
}
