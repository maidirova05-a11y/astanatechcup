import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { isLocale, routing } from "@/i18n/routing";
import { LegalPage } from "@/components/layout/LegalPage";
import { EVENT } from "@/config/event";

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
  const t = await getTranslations({ locale, namespace: "privacy" });
  return {
    title: t("title"),
    // Legal boilerplate has no search value and can outrank real content.
    robots: { index: false, follow: true },
  };
}

const SECTIONS = ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8", "s9"] as const;

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "privacy" });

  // Last meaningful edit to this document, not the build date — a policy that
  // claims to have been updated on every deploy tells the reader nothing.
  const updated = t("updated", { date: "2026-08-18" });

  return (
    <LegalPage
      title={t("title")}
      updated={updated}
      notice={t("draftNotice")}
      intro={t("intro")}
      sections={SECTIONS.map((key) => ({
        title: t(`${key}Title`),
        body: t(`${key}Body`, { organizer: EVENT.organizer }),
      }))}
    />
  );
}
