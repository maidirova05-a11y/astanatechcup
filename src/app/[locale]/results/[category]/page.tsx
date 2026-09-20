import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { isLocale, routing, LOCALE_TAGS } from "@/i18n/routing";
import { ClassBoard } from "@/components/sections/ClassBoard";
import { PageStructuredData } from "@/components/seo/PageStructuredData";
import { getCategory, getCatalogueEntry } from "@/config/categories";
import { getCategorySnapshot, type CategorySnapshot } from "@/lib/scoring/store";
import { env, features } from "@/lib/env";
import { logger } from "@/lib/log";

/**
 * One class of one category: the board a team, a referee and a spectator all
 * end up on.
 *
 * `force-dynamic` for the same reason the index is — a cached document cannot
 * carry the per-request CSP nonce, and a scoreboard that silently loses its
 * scripts is worse than one that costs a query. See the long note in
 * ../page.tsx; scripts/check-csp.mjs enforces it.
 */
export const dynamic = "force-dynamic";

type Params = Promise<{ locale: string; category: string }>;
type Query = Promise<{
  class?: string;
  stage?: string;
  group?: string;
  view?: string;
}>;

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Query;
}): Promise<Metadata> {
  const { locale, category: categoryId } = await params;
  if (!isLocale(locale)) return {};

  const category = getCategory(categoryId);
  if (!category) return {};

  const query = await searchParams;
  const cls =
    category.classes.find((item) => item.id === query.class) ?? category.classes[0];

  const t = await getTranslations({ locale, namespace: "results" });
  const tc = await getTranslations({ locale, namespace: "categories" });

  const title = t("classMetaTitle", { class: cls.label, code: cls.code });
  const path = `/${locale}/results/${category.id}`;

  return {
    title,
    description: t("classMetaDescription", {
      class: cls.label,
      category: tc(`items.${category.id}.name`),
    }),
    alternates: {
      canonical: `${env.APP_URL}${path}`,
      languages: {
        ...Object.fromEntries(
          routing.locales.map((l) => [
            LOCALE_TAGS[l],
            `${env.APP_URL}/${l}/results/${category.id}`,
          ]),
        ),
        /*
         * x-default: the version to serve a language we do not publish. The
         * root layout has always emitted it; these sub-pages did not, so Google
         * had no designated fallback here and picked whichever locale it
         * happened to crawl first.
         */
        "x-default": `${env.APP_URL}/${routing.defaultLocale}/results/${category.id}`,
      },
    },
    openGraph: { title, url: `${env.APP_URL}${path}` },
  };
}

export default async function ClassResultsPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Query;
}) {
  const { locale, category: categoryId } = await params;
  if (!isLocale(locale)) notFound();

  setRequestLocale(locale);

  const category = getCategory(categoryId);
  if (!category) notFound();

  const query = await searchParams;

  /**
   * An unknown `?class=` falls back to the category's first class rather than
   * 404ing. The parameter is a view preference, not an identity: a stale link
   * from a printed programme should still land a visitor on the category they
   * asked for.
   */
  const cls =
    category.classes.find((item) => item.id === query.class) ?? category.classes[0];
  const entry = getCatalogueEntry(category.id, cls.id)!;

  let snapshot: CategorySnapshot | null = null;
  let configured = features.scoring;

  if (features.scoring) {
    try {
      snapshot = await getCategorySnapshot(category.id);
    } catch (error) {
      // Same reasoning as the index: a board that admits it cannot reach the
      // database is a page people refresh; a 500 in the middle of a final is a
      // page people photograph.
      logger.error("results.class_snapshot_failed", {
        categoryId: category.id,
        message: String(error),
      });
      configured = false;
    }
  }

  const t = await getTranslations({ locale, namespace: "results" });
  const tc = await getTranslations({ locale, namespace: "categories" });

  return (
    <>
      {/* Home -> Результаты -> this category. A three-crumb trail is what turns
          a deep scoreboard URL into a result a visitor can place at a glance. */}
      <PageStructuredData
        locale={locale}
        title={t("classMetaTitle", { class: cls.label, code: cls.code })}
        trail={[
          { name: t("title"), path: "/results" },
          {
            name: tc(`items.${category.id}.name`),
            path: `/results/${category.id}`,
          },
        ]}
      />
      <ClassBoard
        locale={locale}
        entry={entry}
        snapshot={snapshot}
        configured={configured}
        view={{
          classId: cls.id,
          stage: query.stage === "playoff" ? "playoff" : "group",
          group: typeof query.group === "string" && query.group !== "" ? query.group : null,
          bracket: query.view === "tree" ? "tree" : "table",
        }}
      />
    </>
  );
}
