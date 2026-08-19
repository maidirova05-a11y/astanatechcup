"use client";

import Script from "next/script";

/**
 * Analytics loader — rendered ONLY after explicit consent (see CookieConsent).
 *
 * Configured through NEXT_PUBLIC_ANALYTICS_SRC / _DOMAIN. With neither set,
 * this renders nothing and the site ships with zero third-party scripts, which
 * is the default the brief left unanswered (section 13 was blank on analytics).
 *
 * The tag is intended for a cookieless, privacy-preserving product such as
 * Plausible. Under `strict-dynamic` this script is injected by Next's own
 * nonce-approved runtime, so it loads without widening the CSP by hand — and
 * the analytics origin is added to `connect-src` only when configured.
 */
export function Analytics() {
  const src = process.env.NEXT_PUBLIC_ANALYTICS_SRC;
  const domain = process.env.NEXT_PUBLIC_ANALYTICS_DOMAIN;

  if (!src || !domain) return null;

  return (
    <Script
      src={src}
      data-domain={domain}
      // Never block first paint for a measurement script.
      strategy="lazyOnload"
    />
  );
}
