import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { isLocale, routing } from "@/i18n/routing";
import { LegalPage } from "@/components/layout/LegalPage";
import { ENTRY_FEE, EVENT, REGISTRATION_DEADLINE } from "@/config/event";
import { formatEventDate } from "@/lib/utils";

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
  const t = await getTranslations({ locale, namespace: "terms" });
  return {
    title: t("title"),
    robots: { index: false, follow: true },
  };
}

const SECTIONS = ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8"] as const;

export default async function TermsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "terms" });

  // The fee and deadline come from src/config/event.ts, so the terms can never
  // state a different price from the registration form.
  const values = {
    organizer: EVENT.organizer,
    coOrganizer: EVENT.coOrganizer,
    amount: ENTRY_FEE.amount,
    currency: ENTRY_FEE.currency,
    deadline: formatEventDate(REGISTRATION_DEADLINE, locale),
  };

  return (
    <LegalPage
      title={t("title")}
      updated={t("updated", { date: "2026-08-18" })}
      notice={t("draftNotice")}
      sections={SECTIONS.map((key) => ({
        title: t(`${key}Title`),
        body: t(`${key}Body`, values),
      }))}
    />
  );
}
