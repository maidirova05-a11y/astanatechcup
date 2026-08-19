import type { MetadataRoute } from "next";
import { env } from "@/lib/env";
import { routing } from "@/i18n/routing";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // API routes, the admin panel and payment return pages. The last of
        // those carry an application reference in the URL, and none of it
        // should ever reach a search index. Derived from the locale list so
        // adding a language cannot silently leave a path exposed.
        disallow: [
          "/api/",
          "/admin",
          ...routing.locales.map((locale) => `/${locale}/payment/`),
        ],
      },
    ],
    sitemap: `${env.APP_URL}/sitemap.xml`,
    host: env.APP_URL,
  };
}
