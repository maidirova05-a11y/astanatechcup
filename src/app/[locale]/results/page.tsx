import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { isLocale, routing, LOCALE_TAGS } from "@/i18n/routing";
import { Results, type ResultsData } from "@/components/sections/Results";
import { CATEGORIES } from "@/config/categories";
import { getCategorySnapshot, type CategorySnapshot } from "@/lib/scoring/store";
import { env, features } from "@/lib/env";
import { logger } from "@/lib/log";

/**
 * Cached for thirty seconds.
 *
 * A scoreboard is the one page a venue full of people refreshes at the same
 * moment, and serving it uncached would turn every final into a load test
 * against Postgres. Thirty seconds is far inside the noise for a table that
 * changes when a judge finishes a sheet — and the console calls
 * `revalidatePath` on every save anyway, so a result that has just landed
 * appears immediately rather than up to half a minute late.
 */
export const revalidate = 30;

/**
 * No `generateStaticParams` of its own — the `[locale]` layout already supplies
 * the three locales, so this page is pre-rendered at build time like every
 * other one, then revalidated.
 *
 * That means `next build` queries Postgres. A build that cannot reach the
 * database must therefore NOT fail: the render below catches it and emits the
 * "not connected" state, which the first revalidation replaces with real
 * results. A database blip in CI taking down a deploy of the whole site would
 * be a much worse failure than a scoreboard that is thirty seconds stale.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};

  const t = await getTranslations({ locale, namespace: "results" });

  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: {
      canonical: `${env.APP_URL}/${locale}/results`,
      languages: Object.fromEntries(
        routing.locales.map((l) => [LOCALE_TAGS[l], `${env.APP_URL}/${l}/results`]),
      ),
    },
    openGraph: {
      title: t("metaTitle"),
      description: t("metaDescription"),
      url: `${env.APP_URL}/${locale}/results`,
    },
  };
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
          await getCategorySnapshot(category.id),
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

  return <Results locale={locale} data={data} />;
}
