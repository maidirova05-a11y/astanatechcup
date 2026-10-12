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
/**
 * Per request, like every page under [locale]: cached HTML cannot carry the
 * CSP nonce the proxy mints, and without it `strict-dynamic` blocks every
 * script on the page. scripts/check-csp.mjs enforces this.
 */
export const dynamic = "force-dynamic";

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
      <div className="container-prose flex flex-col items-start gap-5">
        <span className="flex size-14 items-center justify-center rounded-full border-2 border-ink bg-success text-2xl text-white">
          <Check />
        </span>

        <h1 className="mt-1 text-3xl">{t("successTitle")}</h1>
        <p className="max-w-[36rem] text-base leading-relaxed text-muted md:text-lg">
          {t("successBody", { reference: reference ?? "—" })}
        </p>

        <Link href="/" className={buttonClasses({ variant: "solid", size: "lg", className: "mt-2" })}>
          {t("successCta")}
        </Link>
      </div>
    </div>
  );
}
