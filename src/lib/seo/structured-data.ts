import {
  ENTRY_FEE,
  EVENT,
  EVENT_YEAR,
  BRAND_ASSETS,
  CONTACTS,
  QUALIFIER_START,
  QUALIFIER_END,
  REGISTRATION_DEADLINE,
  VENUE,
  isRegistrationOpen,
} from "@/config/event";
import { LOCALE_TAGS, type Locale } from "@/i18n/routing";

/**
 * schema.org structured data.
 *
 * This is the difference between a search result that shows a blue link and one
 * that shows the dates, the venue, the entry fee and a "Register" action. The
 * page already states all of it in prose; this restates it in the one format a
 * crawler does not have to guess at.
 *
 * ── Two rules, both inherited from the rest of the codebase ───────────────
 *  1. Every value comes from `src/config/event.ts`. Nothing here is a second
 *     copy of a date or a price that can drift out of step with the page.
 *  2. Nothing unconfirmed is emitted. Contact channels are still null, so no
 *     `sameAs`, `email` or `telephone` appears rather than an empty string.
 *     Structured data is a machine-readable *claim*; a wrong one is worse than
 *     a missing one, because it can surface in a knowledge panel unaltered.
 * ──────────────────────────────────────────────────────────────────────────
 */

type Json = Record<string, unknown>;

/** Drops keys whose value is null/undefined/empty, recursively through objects. */
function compact<T extends Json>(input: T): T {
  const out: Json = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === null || value === undefined || value === "") continue;
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      out[key] = value;
      continue;
    }
    if (typeof value === "object") {
      const nested = compact(value as Json);
      if (Object.keys(nested).length === 0) continue;
      out[key] = nested;
      continue;
    }
    out[key] = value;
  }
  return out as T;
}

/** Social profiles the organisers have actually supplied. Empty today. */
function sameAs(): string[] {
  return [CONTACTS.instagram, CONTACTS.tiktok, CONTACTS.youtube, CONTACTS.website].filter(
    (url): url is string => Boolean(url) && String(url).startsWith("http"),
  );
}

export function organizationSchema(appUrl: string): Json {
  return compact({
    "@type": "Organization",
    "@id": `${appUrl}/#organizer`,
    name: EVENT.organizer,
    url: appUrl,
    logo: `${appUrl}${BRAND_ASSETS.organizer.src}`,
    email: CONTACTS.email,
    telephone: CONTACTS.phone,
    sameAs: sameAs(),
    address: {
      "@type": "PostalAddress",
      addressLocality: VENUE.city,
      addressCountry: VENUE.countryCode,
    },
  });
}

function websiteSchema(appUrl: string, locale: Locale, title: string): Json {
  return {
    "@type": "WebSite",
    "@id": `${appUrl}/#website`,
    name: `${EVENT.name} ${EVENT_YEAR}`,
    alternateName: EVENT.name,
    url: `${appUrl}/${locale}`,
    inLanguage: LOCALE_TAGS[locale],
    description: title,
    publisher: { "@id": `${appUrl}/#organizer` },
  };
}

/**
 * The championship itself.
 *
 * `SportsEvent` rather than plain `Event`: robot sumo and drone racing are
 * competitions with rounds and results, and Google's event handling is richer
 * for the sports subtype. The offer is the entry fee, priced per team, and it
 * expires with the registration deadline — so once applications close, the
 * markup says so instead of advertising a closed sale.
 */
function eventSchema(appUrl: string, locale: Locale, description: string): Json {
  const open = isRegistrationOpen();

  return compact({
    "@type": "SportsEvent",
    "@id": `${appUrl}/#event`,
    name: `${EVENT.name} ${EVENT_YEAR}`,
    description,
    url: `${appUrl}/${locale}`,
    image: [`${appUrl}/${locale}/opengraph-image`],
    inLanguage: LOCALE_TAGS[locale],
    startDate: QUALIFIER_START.toISOString(),
    endDate: QUALIFIER_END.toISOString(),
    eventStatus: "https://schema.org/EventScheduled",
    // The brief is explicit that this is an in-person championship.
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place",
      name: VENUE.name,
      address: {
        "@type": "PostalAddress",
        addressLocality: VENUE.city,
        addressRegion: VENUE.region,
        addressCountry: VENUE.countryCode,
      },
    },
    organizer: { "@id": `${appUrl}/#organizer` },
    offers: {
      "@type": "Offer",
      name: ENTRY_FEE.per === "team" ? "Team entry" : "Entry",
      price: String(ENTRY_FEE.amount),
      priceCurrency: ENTRY_FEE.currency,
      url: `${appUrl}/${locale}#register`,
      availability: open
        ? "https://schema.org/InStock"
        : "https://schema.org/SoldOut",
      validThrough: REGISTRATION_DEADLINE.toISOString(),
      category: "Entry fee",
    },
    // Who the event is for. Ages come from the disciplines, which span 7–18.
    audience: {
      "@type": "EducationalAudience",
      educationalRole: "student",
    },
  });
}

/**
 * One `@graph` rather than three separate script tags: the nodes cross-reference
 * each other by `@id` (the event points at the organiser, the site points at the
 * publisher), and a single graph is how a crawler is meant to resolve those.
 */
export function buildStructuredData({
  appUrl,
  locale,
  title,
  description,
}: {
  appUrl: string;
  locale: Locale;
  title: string;
  description: string;
}): Json {
  return {
    "@context": "https://schema.org",
    "@graph": [
      organizationSchema(appUrl),
      websiteSchema(appUrl, locale, title),
      eventSchema(appUrl, locale, description),
    ],
  };
}
