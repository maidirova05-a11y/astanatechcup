import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { isLocale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { buttonClasses } from "@/components/ui/Button";
import { Check } from "@/components/ui/icons";
import { normaliseReference } from "@/lib/reference";

/**
 * Return page after a successful hosted checkout.
 *
 * ⚠ This page is COSMETIC. It mutates nothing and proves nothing: a visitor can
 * type this URL with any reference they like. The application's paid status is
 * set exclusively by the signature-verified webhook at
 * /api/payments/webhook. Treating a browser redirect as proof of payment is
 * the single most common way a checkout integration gets defrauded.
 *
 * The reference from the query string is normalised before display, so a
 * crafted value cannot be reflected onto the page.
 */
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function PaymentSuccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ ref?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const { ref } = await searchParams;
  const t = await getTranslations({ locale, namespace: "payment" });

  const reference = ref ? normaliseReference(ref) : null;

  return (
    <div className="section">
      <div className="container-prose flex flex-col items-start gap-7">
        <span className="flex size-16 items-center justify-center rounded-full bg-success text-3xl text-white">
          <Check />
        </span>

        <h1 className="text-4xl">{t("successTitle")}</h1>
        <p className="text-lg leading-relaxed text-muted">
          {t("successBody", { reference: reference ?? "—" })}
        </p>

        <Link href="/" className={buttonClasses({ variant: "solid", size: "lg" })}>
          {t("successCta")}
        </Link>
      </div>
    </div>
  );
}
