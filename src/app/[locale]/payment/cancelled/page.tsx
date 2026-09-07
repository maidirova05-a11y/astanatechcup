import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { isLocale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { buttonClasses } from "@/components/ui/Button";
import { Info } from "@/components/ui/icons";
import { normaliseReference } from "@/lib/reference";

/**
 * Return page after an abandoned or cancelled checkout.
 *
 * The message is deliberately reassuring and factual: no money was taken, and
 * the application itself is already saved. Losing a registration because the
 * payment step wobbled would be the worst possible outcome for a team that has
 * spent months building a robot.
 */
/**
 * Per request, like every page under [locale]: cached HTML cannot carry the
 * CSP nonce the proxy mints, and without it `strict-dynamic` blocks every
 * script on the page. scripts/check-csp.mjs enforces this.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function PaymentCancelledPage({
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
        <span className="flex size-16 items-center justify-center rounded-full bg-warning-surface text-3xl text-warning">
          <Info />
        </span>

        <h1 className="text-4xl">{t("cancelTitle")}</h1>
        <p className="text-lg leading-relaxed text-muted">
          {t("cancelBody", { reference: reference ?? "—" })}
        </p>

        <Link href="/#register" className={buttonClasses({ variant: "solid", size: "lg" })}>
          {t("cancelCta")}
        </Link>
      </div>
    </div>
  );
}
