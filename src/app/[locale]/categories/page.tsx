import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { isLocale, routing, LOCALE_TAGS } from "@/i18n/routing";
import { CategoryCatalogue } from "@/components/sections/CategoryCatalogue";
import { env } from "@/lib/env";

/**
 * The rules page.
 *
 * Fully static: nothing on it depends on a request, and the numbers change
 * when a rulebook is revised, not when someone loads the page. Pre-rendering
 * all three locales means the one page a team opens on venue wi-fi, standing
 * next to the inspection gauge, is served from the edge.
 */
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

  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: {
      canonical: `${env.APP_URL}/${locale}/categories`,
      languages: Object.fromEntries(
        routing.locales.map((l) => [LOCALE_TAGS[l], `${env.APP_URL}/${l}/categories`]),
      ),
    },
    openGraph: {
      title: t("metaTitle"),
      description: t("metaDescription"),
      url: `${env.APP_URL}/${locale}/categories`,
    },
  };
}

export default async function CategoriesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  setRequestLocale(locale);

  return <CategoryCatalogue locale={locale} />;
}
