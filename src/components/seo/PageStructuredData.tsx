import { headers } from "next/headers";
import { breadcrumbSchema } from "@/lib/seo/structured-data";
import { env } from "@/lib/env";
import { EVENT, EVENT_YEAR } from "@/config/event";
import { LOCALE_TAGS, type Locale } from "@/i18n/routing";

/**
 * schema.org for an indexable page BELOW the landing page.
 *
 * Two nodes, plus whatever the page itself owns (`extraNodes`): the page, and
 * the trail back to the home page. Deliberately NOT the organisation, the event
 * or the FAQ — those are stated
 * once, on the landing page, and repeating them here would give a crawler two
 * copies of the same entity to reconcile for no gain.
 *
 * What it buys: a result that reads
 * "astanatechcup.kz › AstanaTechCup 2026 › Дисциплины" instead of a bare URL,
 * and an explicit statement that this page belongs to the site rather than
 * being an orphan a crawler found by following a link.
 *
 * `trail` names the crumbs BELOW the home page, in order. Each `name` must be
 * what the page actually shows as its heading — Google compares the markup
 * against the rendered page and ignores a trail that disagrees with it.
 *
 * The nonce, the JSON escaping and the reasoning behind both are the same as in
 * `StructuredData.tsx`; see the long note there.
 */
export async function PageStructuredData({
  locale,
  title,
  description,
  trail,
  extraNodes = [],
}: {
  locale: Locale;
  title: string;
  description?: string;
  trail: readonly { name: string; path: string }[];
  /**
   * Further nodes for this page's graph — e.g. the `ItemList` of categories on
   * the rules page. They join the same `@graph` so a crawler resolves their
   * `@id` references against the WebPage node above rather than a second
   * script tag. Callers build them with the helpers in `lib/seo/structured-data`
   * from the SAME translations the page renders; nothing here rewrites them.
   */
  extraNodes?: readonly Record<string, unknown>[];
}) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const appUrl = env.APP_URL;
  const path = trail.length ? trail[trail.length - 1].path : "";

  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${appUrl}/${locale}${path}#webpage`,
        url: `${appUrl}/${locale}${path}`,
        name: title,
        ...(description ? { description } : {}),
        inLanguage: LOCALE_TAGS[locale],
        isPartOf: { "@id": `${appUrl}/#website` },
        about: { "@id": `${appUrl}/#event` },
        breadcrumb: { "@id": `${appUrl}/${locale}${path}#breadcrumb` },
      },
      breadcrumbSchema(appUrl, locale, `${EVENT.name} ${EVENT_YEAR}`, trail),
      ...extraNodes,
    ],
  };

  return (
    <script
      type="application/ld+json"
      nonce={nonce}
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(graph).replace(/</g, "\\u003c"),
      }}
    />
  );
}
