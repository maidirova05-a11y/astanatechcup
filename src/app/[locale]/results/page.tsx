import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { isLocale } from "@/i18n/routing";
import { ResultsIndex, type ResultsData } from "@/components/sections/ResultsIndex";
import { PageStructuredData } from "@/components/seo/PageStructuredData";
import { pageMetadata } from "@/lib/seo/metadata";
import { CATEGORIES } from "@/config/categories";
import type { CategorySnapshot } from "@/lib/scoring/store";
import { getPublicCategorySnapshot } from "@/lib/scoring/public";
import { features } from "@/lib/env";
import { logger } from "@/lib/log";

/**
 * Per request, and NOT cached — which costs this page exactly the thing it
 * most wanted.
 *
 * It was `revalidate = 30`, on the reasoning that a scoreboard is the one page
 * a venue full of people refreshes at the same moment, and that serving it
 * uncached turns every final into a load test against Postgres. That reasoning
 * still holds.
 *
 * What it missed: cached HTML cannot carry a per-request CSP nonce. The proxy
 * mints one for every request; the cached copy has none; under `strict-dynamic`
 * the mismatch blocks every script on the page. The scoreboard's own
 * thirty-second auto-refresh is JavaScript — so caching the scoreboard was
 * precisely what stopped it refreshing, and on 15 May the hall would have
 * watched a frozen table while judges filed results into it.
 *
 * So the QUERY is cached instead of the HTML: the snapshots come from
 * `getPublicCategorySnapshot` (src/lib/scoring/public.ts), shared across
 * requests and expired by every judge write, with a 30-second backstop. The
 * document stays per-request for as long as the CSP carries a nonce.
 * scripts/check-csp.mjs enforces that.
 */
export const dynamic = "force-dynamic";

/**
 * A database that cannot be reached must NOT fail the render: the page below
 * catches it and emits the "not connected" state. A failed load is not cached
 * (`unstable_cache` stores only resolved values), so the next view retries.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};

  const t = await getTranslations({ locale, namespace: "results" });

  return pageMetadata(locale, "/results", {
    title: t("metaTitle"),
    description: t("metaDescription"),
    keywords: t("metaKeywords"),
  });
}

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  setRequestLocale(locale);

  const snapshots = new Map<string, CategorySnapshot>();

  /**
   * With no database the page still renders — it says the system is not
   * connected. A results URL that 500s during a championship is worse than one
   * that admits it has nothing yet, and this is also the state a designer runs
   * the site in locally.
   */
  let reachable = features.scoring;

  if (features.scoring) {
    try {
      const loaded = await Promise.all(
        CATEGORIES.map(async (category) => [
          category.id,
          await getPublicCategorySnapshot(category.id),
        ] as const),
      );
      for (const [id, snapshot] of loaded) snapshots.set(id, snapshot);
    } catch (error) {
      /**
       * A scoreboard that 500s in the middle of a final is worse than one
       * admitting it cannot reach the database — the second is a page people
       * refresh, the first is a page people photograph. Neon cold starts and
       * connection-limit blips are both real, and neither should take the page
       * down.
       */
      logger.error("results.snapshot_failed", { message: String(error) });
      reachable = false;
      snapshots.clear();
    }
  }

  const data: ResultsData = { snapshots, configured: reachable };

  const t = await getTranslations({ locale, namespace: "results" });

  return (
    <>
      <PageStructuredData
        locale={locale}
        title={t("metaTitle")}
        description={t("metaDescription")}
        trail={[{ name: t("title"), path: "/results" }]}
      />
      <ResultsIndex locale={locale} data={data} />
    </>
  );
}
