import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { isLocale } from "@/i18n/routing";
import { Hero } from "@/components/sections/Hero";
import { Stats } from "@/components/sections/Stats";
import { Flagship } from "@/components/sections/Flagship";
import { Disciplines } from "@/components/sections/Disciplines";
import { Journey } from "@/components/sections/Journey";
import { Prizes } from "@/components/sections/Prizes";
import { Audiences } from "@/components/sections/Audiences";
import { Registration } from "@/components/sections/Registration";
import { Faq } from "@/components/sections/Faq";
import { Gallery } from "@/components/sections/Gallery";
import { Partners } from "@/components/sections/Partners";
import { Contacts } from "@/components/sections/Contacts";
import { StructuredData } from "@/components/seo/StructuredData";

/**
 * The landing page.
 *
 * Section order is the argument the page makes, in order:
 *   what this is → is it real → the hook → what you can enter →
 *   how it works → what you win → who you are → sign up →
 *   your objections → proof → who runs it → how to reach them
 *
 * Registration sits deliberately in the middle rather than at the end: by that
 * point a visitor has the discipline, the path and the prize, which is
 * everything they need to decide. The FAQ then catches whoever is still
 * hesitating, and every one of its answers targets a barrier the brief named.
 */

/**
 * Stated explicitly, though this page already renders per request as a side
 * effect of reading `headers()` for the CSRF token.
 *
 * That is the problem: it is dynamic by accident. A refactor that moved the
 * token elsewhere would make the landing page static, and a static page under
 * a nonce-based CSP has every one of its scripts blocked — the failure that
 * emptied four other routes for nine days, on the page that takes entries.
 * A guarantee this load-bearing should not rest on a `headers()` call nobody
 * knows is holding it up. scripts/check-csp.mjs enforces it.
 */
export const dynamic = "force-dynamic";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  setRequestLocale(locale);

  return (
    <>
      {/* schema.org graph for the event, the organiser and the site. Renders
          nothing visible; it is what turns a plain blue link in search results
          into dates, venue, entry fee and a registration action. */}
      <StructuredData locale={locale} />

      <Hero locale={locale} />
      <Stats locale={locale} />
      <Flagship locale={locale} />
      <Disciplines locale={locale} />
      <Journey locale={locale} />
      <Prizes locale={locale} />
      <Audiences locale={locale} />
      <Registration locale={locale} />
      <Faq locale={locale} />
      <Gallery locale={locale} />
      <Partners locale={locale} />
      <Contacts locale={locale} />
    </>
  );
}
