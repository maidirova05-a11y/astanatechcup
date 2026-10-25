import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { isLocale, routing } from "@/i18n/routing";
import { CategoryCatalogue } from "@/components/sections/CategoryCatalogue";
import { PageStructuredData } from "@/components/seo/PageStructuredData";
import { categoryListSchema } from "@/lib/seo/structured-data";
import { pageMetadata } from "@/lib/seo/metadata";
import { CATEGORIES } from "@/config/categories";
import { env } from "@/lib/env";

/**
 * The rules page.
 *
 * Nothing on it depends on a request — the numbers change when a rulebook is
 * revised, not when someone loads the page — so it *wants* to be static, and
 * was, served from the edge to a team standing next to the inspection gauge.
 *
 * It cannot be. The proxy mints a CSP nonce per request and Next stamps it on
 * the framework's own <script> tags; HTML built once at deploy time carries no
 * nonce at all, while the header still demands one. Under `strict-dynamic`
 * that blocks every script on the page, React never hydrates, and the
 * scroll-reveal animation leaves the whole catalogue at `opacity: 0` — a page
 * that looks blank while `innerText` still reports its 2,600 characters, which
 * is why no text-based check caught it for nine days.
 *
 * A nonce-based policy and cached HTML are mutually exclusive. Cache the data
 * if load ever bites; the HTML has to stay per-request.
 * scripts/check-csp.mjs enforces this.
 */
export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};

  const t = await getTranslations({ locale, namespace: "categories" });

  /*
   * Keywords are the page's own — "робосумо регламент", "Drone Soccer
   * правила" — not the site-wide core from the layout, which Next would
   * otherwise inherit for every page. A visitor searching for a ruleset should
   * land here, not on the landing page.
   */
  return pageMetadata(locale, "/categories", {
    title: t("metaTitle"),
    description: t("metaDescription"),
    keywords: t("metaKeywords"),
  });
}

export default async function CategoriesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "categories" });

  return (
    <>
      {/* The crumb name is `title`, not `metaTitle`: it has to be the heading a
          visitor sees, because Google compares the two. */}
      <PageStructuredData
        locale={locale}
        title={t("metaTitle")}
        description={t("metaDescription")}
        trail={[{ name: t("title"), path: "/categories" }]}
        extraNodes={[
          // The seven categories as an ItemList, named with the SAME strings
          // the catalogue below renders as its headings and taglines. The
          // anchors are the section ids CategoryCatalogue already emits.
          categoryListSchema(
            env.APP_URL,
            locale,
            "/categories",
            t("title"),
            CATEGORIES.map((category) => ({
              id: category.id,
              name: t(`items.${category.id}.name`),
              description: t(`items.${category.id}.tagline`),
            })),
          ),
        ]}
      />
      <CategoryCatalogue locale={locale} />
    </>
  );
}
