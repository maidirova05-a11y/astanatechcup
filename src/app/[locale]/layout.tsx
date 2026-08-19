import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing, isLocale, LOCALE_TAGS, type Locale } from "@/i18n/routing";
import { EVENT_YEAR, EVENT } from "@/config/event";
import { env } from "@/lib/env";
import { fontVariables } from "@/app/fonts";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { CookieConsent } from "@/components/layout/CookieConsent";
import "@/app/globals.css";

/** Both locales are known ahead of time, so both can be statically rendered. */
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Never lock zoom — pinch-to-zoom is an accessibility requirement, and the
  // audience includes parents reading small print on a phone.
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#060e22" },
  ],
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};

  const t = await getTranslations({ locale, namespace: "meta" });

  const title = t("title", { year: EVENT_YEAR });
  const description = t("description");

  return {
    metadataBase: new URL(env.APP_URL),
    title: {
      default: title,
      template: `%s · ${t("titleShort", { year: EVENT_YEAR })}`,
    },
    description,
    applicationName: EVENT.name,
    // hreflang for every locale plus x-default, so Google serves Kazakh
    // speakers the Kazakh page instead of whichever it crawled first.
    alternates: {
      canonical: `/${locale}`,
      languages: {
        ...Object.fromEntries(
          routing.locales.map((l) => [LOCALE_TAGS[l], `/${l}`]),
        ),
        "x-default": `/${routing.defaultLocale}`,
      },
    },
    openGraph: {
      type: "website",
      siteName: EVENT.name,
      title,
      description,
      locale: LOCALE_TAGS[locale].replace("-", "_"),
      url: `/${locale}`,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, "max-image-preview": "large" },
    },
    formatDetection: {
      // Stop iOS turning every number in the copy into a phone link.
      telephone: false,
      date: false,
      address: false,
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // The proxy already redirects unprefixed paths, but a hand-typed /xx must
  // 404 rather than fall through to the default locale's content.
  if (!isLocale(locale)) notFound();

  // Opts this subtree into static rendering.
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "common" });

  return (
    <html lang={LOCALE_TAGS[locale as Locale]} className={fontVariables}>
      <body className="min-h-dvh bg-surface text-content antialiased">
        <a href="#main" className="skip-link">
          {t("skipToContent")}
        </a>

        {/*
          Messages are passed to the client provider so client components
          (the registration form, the countdown, the locale switcher) can
          translate. next-intl ships only what the client tree actually uses.
        */}
        <NextIntlClientProvider>
          <Header locale={locale} />
          <main id="main" tabIndex={-1} className="focus:outline-none">
            {children}
          </main>
          <Footer locale={locale} />
          <CookieConsent />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
