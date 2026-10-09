"use client";

import { useEffect } from "react";
import { YANDEX_METRIKA_ID } from "@/lib/security/constants";

declare global {
  interface Window {
    ym?: ((...args: unknown[]) => void) & { a?: unknown[][]; l?: number };
  }
}

const TAG_SRC = `https://mc.yandex.ru/metrika/tag.js?id=${YANDEX_METRIKA_ID}`;

/**
 * Yandex.Metrika — rendered ONLY after explicit consent (see CookieConsent).
 *
 * This is the official counter snippet, run from the bundle instead of an
 * inline <script>: the CSP is nonce + `strict-dynamic`, so an inline tag
 * would need the nonce threaded through, while a script element created here
 * inherits trust from Next's nonce-approved runtime. tag.js and Webvisor then
 * load the same way; the hosts they call home to are in `buildCsp`.
 */
export function YandexMetrika() {
  useEffect(() => {
    if (document.querySelector(`script[src="${TAG_SRC}"]`)) return;

    const ym: NonNullable<Window["ym"]> =
      window.ym ??
      function (...args: unknown[]) {
        (ym.a = ym.a || []).push(args);
      };
    ym.l = Date.now();
    window.ym = ym;

    const script = document.createElement("script");
    script.async = true;
    script.src = TAG_SRC;
    document.head.appendChild(script);

    ym(YANDEX_METRIKA_ID, "init", {
      ssr: true,
      webvisor: true,
      clickmap: true,
      ecommerce: "dataLayer",
      referrer: document.referrer,
      url: location.href,
      accurateTrackBounce: true,
      trackLinks: true,
    });
  }, []);

  return null;
}
