"use client";

import { useEffect } from "react";
import { GOOGLE_ANALYTICS_ID } from "@/lib/security/constants";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const TAG_SRC = `https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ANALYTICS_ID}`;

/**
 * Google Analytics 4 — rendered ONLY after explicit consent (see CookieConsent).
 *
 * The official gtag.js snippet, run from the bundle for the same reason as
 * YandexMetrika: under the nonce + `strict-dynamic` CSP a script element
 * created here inherits trust from Next's nonce-approved runtime, while an
 * inline tag would need the nonce threaded through. The hosts it calls home
 * to are in `buildCsp`.
 */
export function GoogleAnalytics() {
  useEffect(() => {
    if (document.querySelector(`script[src="${TAG_SRC}"]`)) return;

    window.dataLayer = window.dataLayer || [];
    // gtag.js reads the `arguments` object itself, not an array copy of it.
    window.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer!.push(arguments);
    };
    window.gtag("js", new Date());
    window.gtag("config", GOOGLE_ANALYTICS_ID);

    const script = document.createElement("script");
    script.async = true;
    script.src = TAG_SRC;
    document.head.appendChild(script);
  }, []);

  return null;
}
