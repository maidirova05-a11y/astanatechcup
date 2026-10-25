import type { Metadata } from "next";
import { env } from "@/lib/env";
import { EVENT, EVENT_YEAR } from "@/config/event";
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

/**
 * The share card from `app/[locale]/opengraph-image.tsx`.
 *
 * Next attaches a file-based image only while no deeper segment sets the
 * object it lives in. A sub-page that sets `openGraph` or `twitter` replaces
 * the inherited object whole, image included, so every link shared from
 * /categories or /results rendered without a picture. Restated here, with the
 * dimensions and alt the image file exports.
 */
export function shareImage(locale: Locale) {
  return {
    url: `${env.APP_URL}/${locale}/opengraph-image`,
    width: 1200,
    height: 630,
    type: "image/png",
    alt: `${EVENT.name} ${EVENT_YEAR}`,
  };
}

/** Open Graph for a sub-page, carrying the site-level fields the layout would otherwise have set. */
export function pageOpenGraph(
  locale: Locale,
  path: string,
  { title, description }: { title: string; description?: string },
): NonNullable<Metadata["openGraph"]> {
  return {
    type: "website",
    siteName: EVENT.name,
    title,
    ...(description ? { description } : {}),
    locale: LOCALE_TAGS[locale].replace("-", "_"),
    url: `${env.APP_URL}/${locale}${path}`,
    images: [shareImage(locale)],
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
    twitter: { card: "summary_large_image", title, description, images: [shareImage(locale)] },
  };
}
