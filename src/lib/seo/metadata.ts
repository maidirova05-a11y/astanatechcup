import type { Metadata } from "next";
import { env } from "@/lib/env";
import { EVENT } from "@/config/event";
import { routing, LOCALE_TAGS, type Locale } from "@/i18n/routing";

/**
 * Metadata fragments shared by every indexable page below the landing page.
 *
 * The `[locale]` layout sets `metadataBase`, the title template, the keyword
 * core and the home page's alternates. A sub-page then has to restate three
 * things for its own URL — canonical, hreflang and Open Graph — and until now
 * each page carried its own copy of that block. Three copies drift: one page
 * had an Open Graph description and another did not, and none of them carried
 * `siteName` or `og:type`, because Next replaces a nested `openGraph` object
 * wholesale rather than merging it with the layout's.
 *
 * `path` is the locale-less route, e.g. "/categories" or "/results/sumo".
 */

/** `meta.keywords` is one comma-separated string per locale; <meta> wants a list. */
export function keywordList(value: string): string[] {
  return value
    .split(",")
    .map((keyword) => keyword.trim())
    .filter((keyword) => keyword.length > 0);
}

/**
 * Canonical + hreflang for one route, in every locale.
 *
 * `x-default` names the default locale: the root layout has always emitted it,
 * and without it on a sub-page Google had no designated fallback for a
 * language we do not publish and picked whichever locale it crawled first.
 */
export function localizedAlternates(locale: Locale, path: string): NonNullable<Metadata["alternates"]> {
  return {
    canonical: `${env.APP_URL}/${locale}${path}`,
    languages: {
      ...Object.fromEntries(
        routing.locales.map((l) => [LOCALE_TAGS[l], `${env.APP_URL}/${l}${path}`]),
      ),
      "x-default": `${env.APP_URL}/${routing.defaultLocale}${path}`,
    },
  };
}

/** Open Graph for a sub-page, carrying the site-level fields the layout would otherwise have set. */
export function pageOpenGraph(
  locale: Locale,
  path: string,
  { title, description }: { title: string; description: string },
): NonNullable<Metadata["openGraph"]> {
  return {
    type: "website",
    siteName: EVENT.name,
    title,
    description,
    locale: LOCALE_TAGS[locale].replace("-", "_"),
    url: `${env.APP_URL}/${locale}${path}`,
  };
}

/** Everything a sub-page's `generateMetadata` returns, assembled in one place. */
export function pageMetadata(
  locale: Locale,
  path: string,
  { title, description, keywords }: { title: string; description: string; keywords?: string },
): Metadata {
  return {
    title,
    description,
    ...(keywords ? { keywords: keywordList(keywords) } : {}),
    alternates: localizedAlternates(locale, path),
    openGraph: pageOpenGraph(locale, path, { title, description }),
    twitter: { card: "summary_large_image", title, description },
  };
}
