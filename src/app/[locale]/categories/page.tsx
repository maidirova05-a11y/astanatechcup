import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { isLocale, routing, LOCALE_TAGS } from "@/i18n/routing";
import { CategoryCatalogue } from "@/components/sections/CategoryCatalogue";
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
