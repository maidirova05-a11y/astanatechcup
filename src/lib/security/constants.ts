/**
 * Security constants that BOTH the client and the server need.
 *
 * ── Why this file exists ─────────────────────────────────────────────────
 * The form components are client components. They need the CSRF field name,
 * the honeypot field name and so on. Previously they imported those from
 * `csrf.ts` / `turnstile.ts` / `csp.ts`, each of which imports `@/lib/env` —
 * so `env.ts` was pulled into the browser bundle, where `process.env.CSRF_SECRET`
 * does not exist but `NODE_ENV` is still `"production"`. The result: the
 * production readiness gate threw inside the browser and every page rendered
 * its error boundary.
 *
 * That failure is invisible to `next build` and to `npm run dev`. It only
 * appears in a production runtime, which is the worst place to find it.
 *
 * So: this module has NO IMPORTS AT ALL, and it is the only security module a
 * client component may import. Keep it that way.
 * ─────────────────────────────────────────────────────────────────────────
 */

/** Hidden form field carrying the CSRF token. */
export const CSRF_FIELD = "csrfToken";

/** Request header the proxy uses to forward the token to the render. */
export const CSRF_HEADER = "x-csrf-token";

/** Request header carrying the signed "form served at" stamp. */
export const FORM_TS_HEADER = "x-form-rendered-at";

/**
 * Honeypot input name. Rendered off-screen with `aria-hidden` and
 * `tabindex="-1"`, so a human never fills it and a screen reader never
 * announces it — but naive bots fill every input they find.
 */
export const HONEYPOT_FIELD = "website_url";

/** Hidden field holding the signed render timestamp. */
export const FORM_TIMESTAMP_FIELD = "form_loaded_at";

/** Cloudflare Turnstile origin, needed by both the CSP and the widget loader. */
export const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";
