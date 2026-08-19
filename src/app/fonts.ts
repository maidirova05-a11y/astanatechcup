import { Manrope, Inter } from "next/font/google";

/**
 * Typefaces.
 *
 * SELECTION CONSTRAINT — the site must set Russian *and* Kazakh. Kazakh needs
 * the extended Cyrillic letters ә ғ қ ң ө ұ ү һ і, which live outside the basic
 * Cyrillic block. A face without the `cyrillic-ext` subset renders those as
 * tofu, and it is the kind of bug nobody notices until a Kazakh speaker opens
 * the page. Both families below ship `cyrillic-ext`, and both subsets are
 * requested explicitly.
 *
 * next/font downloads the files at build time and serves them from our own
 * origin. That means: no request to fonts.gstatic.com (so `font-src 'self'` in
 * the CSP holds), no IP address handed to a third party, and no render-blocking
 * external round trip.
 */

export const manrope = Manrope({
  subsets: ["latin", "latin-ext", "cyrillic", "cyrillic-ext"],
  weight: ["500", "700", "800"],
  variable: "--font-manrope",
  display: "swap",
  // Metric-matched fallback: reduces the layout shift when the webfont lands.
  adjustFontFallback: true,
});

export const inter = Inter({
  subsets: ["latin", "latin-ext", "cyrillic", "cyrillic-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
  adjustFontFallback: true,
});

export const fontVariables = `${manrope.variable} ${inter.variable}`;
