import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { isLocale, routing } from "@/i18n/routing";
import { LegalPage } from "@/components/layout/LegalPage";

/**
 * Per-request, because a cached copy cannot carry the CSP nonce the proxy
 * mints for every request — and under `strict-dynamic` a missing nonce blocks
 * every script on the page. See the longer note in ../categories/page.tsx;
 * scripts/check-csp.mjs enforces it.
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
  const t = await getTranslations({ locale, namespace: "oferta" });
  return {
    title: t("title"),
    description: t("description"),
    // Same as /privacy and /terms: legal boilerplate stays out of the index.
    robots: { index: false, follow: true },
  };
}

/** A paragraph is a string, a bulleted list is an array of strings. */
type Block = string | string[];

/**
 * The AZ GROUP LLC public offer — the same document the AZ GROUP olympiad
 * sites publish. The text is a legal document, so it is kept verbatim in the
 * catalogs and read with `t.raw`: nothing in it is interpolated.
 */
export default async function OfertaPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "oferta" });
  const sections = t.raw("sections") as { title: string; blocks: Block[] }[];
  const details = t.raw("details") as { title: string; rows: { label: string; value: string }[] };

  return (
    <LegalPage
      title={t("title")}
      updated={t.raw("updated") as string}
      intro={t("intro")}
      sections={[
        ...sections.map((section) => ({
          title: section.title,
          body: section.blocks.map((block) =>
            typeof block === "string" ? (
              <p key={block}>{block}</p>
            ) : (
              <ul key={block.join()} className="list-disc space-y-1 pl-5">
                {block.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ),
          ),
        })),
        {
          title: details.title,
          body: (
            <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-[max-content_1fr]">
              {details.rows.map((row) => (
                <div key={row.label} className="contents">
                  <dt className="text-subtle">{row.label}</dt>
                  <dd className="mb-2 break-words font-medium text-content sm:mb-0">
                    {row.value.includes("@") ? (
                      <a href={`mailto:${row.value}`} className="underline underline-offset-2">
                        {row.value}
                      </a>
                    ) : row.value.startsWith("https://") ? (
                      <a
                        href={row.value}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline underline-offset-2"
                      >
                        {row.value}
                      </a>
                    ) : (
                      row.value
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          ),
        },
      ]}
    />
  );
}
