import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { routing, isLocale, LOCALE_TAGS, type Locale } from "@/i18n/routing";
import { EVENT_YEAR, EVENT } from "@/config/event";
import { env } from "@/lib/env";
import { fontVariables } from "@/app/fonts";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { CookieConsent } from "@/components/layout/CookieConsent";
import { AttributionCapture } from "@/components/layout/AttributionCapture";
import "@/app/globals.css";

/**
 * The message namespaces a CLIENT component reads, and the only ones sent to
 * the browser.
 *
 * Without an explicit `messages` prop, next-intl 4's provider forwards the
 * whole catalogue — ~51k characters of Russian, Kazakh or English, legal pages
 * included — inlined into the RSC payload of every HTML response and parsed on
 * every page load, while server components (which are most of this site) read
 * their strings on the server and never needed them in the browser.
 *
 * Add a namespace here when a "use client" component starts calling
 * `useTranslations` with it; a missing one throws in the browser, which the
 * Playwright pass (no console errors on every route) catches.
 *
 *   common, nav      — Header, LocaleSwitcher
 *   countdown        — Countdown
 *   consent          — CookieConsent
 *   registration,
 *   disciplines,
 *   regions          — RegistrationForm
 *   error            — app/[locale]/error.tsx
 */
const CLIENT_NAMESPACES = [
  "common",
  "nav",
  "countdown",
  "consent",
  "registration",
  "disciplines",
  "regions",
  "error",
] as const;

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
  const description = t("description", { year: EVENT_YEAR });
  const keywords = t("keywords", { year: EVENT_YEAR })
    .split(",")
    .map((k) => k.trim());

  return {
    metadataBase: new URL(env.APP_URL),
    title: {
      default: title,
      template: `%s · ${t("titleShort", { year: EVENT_YEAR })}`,
    },
    description,
    keywords,
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

    /*
     * Site-ownership proof for the two consoles that matter here. Until one of
     * these verifies, the property cannot be claimed at all: no sitemap
     * submission, no index coverage report, no way to ask for a recrawl.
     *
     * Emitted ONLY when the token is present. Both consoles re-check the tag
     * periodically and withdraw verification when it vanishes or turns up
     * empty, so an unconfigured deploy must ship no tag rather than a blank
     * one that reads as a failed check.
     *
     * `other` is used for Yandex because next/metadata has no first-class
     * field for it — Google, Bing and Yahoo do.
     */
    verification: {
      ...(env.GOOGLE_SITE_VERIFICATION
        ? { google: env.GOOGLE_SITE_VERIFICATION }
        : {}),
      ...(env.YANDEX_SITE_VERIFICATION
        ? { other: { "yandex-verification": env.YANDEX_SITE_VERIFICATION } }
        : {}),
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
  const messages = await getMessages({ locale });
  const clientMessages = Object.fromEntries(
    CLIENT_NAMESPACES.filter((key) => key in messages).map((key) => [key, messages[key]]),
  );

  return (
    <html lang={LOCALE_TAGS[locale as Locale]} className={fontVariables}>
      <body className="min-h-dvh bg-surface text-content antialiased">
        <a href="#main" className="skip-link">
          {t("skipToContent")}
        </a>

        {/*
          Only the namespaces client components read — see CLIENT_NAMESPACES.
          Locale, time zone and `now` are still inherited from the request
          config.
        */}
        <NextIntlClientProvider messages={clientMessages}>
          <Header locale={locale} />
          <main id="main" tabIndex={-1} className="focus:outline-none">
            {children}
          </main>
          <Footer locale={locale} />
          <CookieConsent />
          <AttributionCapture />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
