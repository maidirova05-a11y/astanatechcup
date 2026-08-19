import { defineRouting } from "next-intl/routing";

/**
 * Q12 of the brief asked for Russian + Kazakh; English was added afterwards,
 * which the event's international framing and the RobotChallenge pipeline make
 * an easy call — sponsors and foreign partners need it.
 *
 * Q13: an in-page switcher, not separate sites — so all three locales are
 * prefixed routes off one deployment (/ru, /kk, /en).
 *
 * This file is the only place the locale list lives. The switcher,
 * <html lang>, hreflang tags, the sitemap and the Stripe checkout locale all
 * read from here.
 */
export const routing = defineRouting({
  locales: ["ru", "kk", "en"],
  defaultLocale: "ru",
  localePrefix: "always",
  // Kazakhstan is bilingual and browsers frequently report `ru` for both
  // local audiences; a wrong auto-redirect is more annoying than a default, so
  // detection is on but the switcher is always visible in the header.
  localeDetection: true,
});

export type Locale = (typeof routing.locales)[number];

/**
 * BCP-47 tags for <html lang> and hreflang.
 *
 * Russian and Kazakh are tagged -KZ because they are the in-country variants.
 * English is left region-neutral: it is there for an international audience,
 * not for English speakers in Kazakhstan specifically.
 */
export const LOCALE_TAGS: Record<Locale, string> = {
  ru: "ru-KZ",
  kk: "kk-KZ",
  en: "en",
};

/** Endonyms — a language switcher must name each language in that language. */
export const LOCALE_LABELS: Record<Locale, string> = {
  ru: "Русский",
  kk: "Қазақша",
  en: "English",
};

export const LOCALE_SHORT: Record<Locale, string> = {
  ru: "RU",
  kk: "ҚАЗ",
  en: "EN",
};

export function isLocale(value: string): value is Locale {
  return (routing.locales as readonly string[]).includes(value);
}
