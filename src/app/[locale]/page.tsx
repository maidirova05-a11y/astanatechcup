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
