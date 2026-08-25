import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { buildStructuredData } from "@/lib/seo/structured-data";
import { EVENT_YEAR } from "@/config/event";
import { env } from "@/lib/env";
import type { Locale } from "@/i18n/routing";

/**
 * Emits the schema.org graph for the landing page.
 *
 * ── Why the nonce ────────────────────────────────────────────────────────
 * `src/lib/security/csp.ts` builds a strict `script-src` with a per-request
 * nonce and `strict-dynamic`. Browsers disagree about whether a data block —
 * `<script type="application/ld+json">`, which is never executed — falls under
 * that directive, and the ones that say yes drop the tag silently. Stamping the
 * nonce that `src/proxy.ts` already minted costs nothing and settles the
 * question in every browser. Crawlers do not enforce CSP, so the markup would
 * be read either way; this is about not leaving a console error on a page whose
 * whole security posture is "no inline script, ever".
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Escaping: `JSON.stringify` cannot emit a raw `<`, so `</script>` cannot be
 * produced from the config values. `<` is escaped anyway — belt and braces
 * against a future value arriving from somewhere less trusted than a constant.
 */
export async function StructuredData({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "meta" });
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  const graph = buildStructuredData({
    appUrl: env.APP_URL,
    locale,
    title: t("title", { year: EVENT_YEAR }),
    description: t("description"),
  });

  const json = JSON.stringify(graph).replace(/</g, "\\u003c");

  return (
    <script
      type="application/ld+json"
      nonce={nonce}
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
