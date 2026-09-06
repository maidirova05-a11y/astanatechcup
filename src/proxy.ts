import { NextResponse, type NextRequest } from "next/server";
import { routing, isLocale, type Locale } from "@/i18n/routing";
import { buildCsp, generateNonce, staticSecurityHeaders, CSP_HEADER_NAME } from "@/lib/security/csp";
import {
  CSRF_COOKIE,
  CSRF_HEADER,
  FORM_TS_HEADER,
  createCsrfToken,
  createTimestampToken,
  csrfCookieOptions,
  isSameOrigin,
  verifyCsrfToken,
} from "@/lib/security/csrf";
import { securityLog } from "@/lib/log";

/**
 * Edge proxy (Next.js 16's replacement for `middleware.ts`).
 *
 * Responsibilities, in order:
 *   1. Reject cross-site state-changing requests (Origin/Referer check).
 *   2. Mint a per-request CSP nonce and forward it to the render.
 *   3. Issue / refresh the CSRF token cookie.
 *   4. Locale negotiation and redirect.
 *   5. Attach security headers to every response.
 *
 * Locale routing is implemented here rather than via next-intl's middleware on
 * purpose: `localePrefix: "always"` means there is nothing to *rewrite* — every
 * valid URL already carries its locale and maps straight onto `app/[locale]`.
 * All the middleware would add is negotiation and a redirect, which is the code
 * below. Doing it directly keeps `NextResponse.next({ request })` in our hands,
 * which is the only supported way to propagate the CSP nonce into the render.
 * `getRequestConfig` still resolves the locale from the route segment, so the
 * rest of next-intl is unaffected.
 */

/** Cookie name next-intl also reads, so a manual switch is remembered. */
const LOCALE_COOKIE = "NEXT_LOCALE";

const LOCALE_COOKIE_OPTIONS = {
  path: "/",
  sameSite: "lax" as const,
  maxAge: 60 * 60 * 24 * 365,
  // Readable by the client is fine — a locale preference is not a secret,
  // and it lets a static export honour it without a round trip.
  httpOnly: false,
};

export default async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  /* ── 1. Cross-site request forgery, layer one ─────────────────────────── */

  const isStateChanging = !["GET", "HEAD", "OPTIONS"].includes(request.method);

  if (isStateChanging && !isMachineEndpoint(pathname) && !isSameOrigin(request)) {
    securityLog.originMismatch({
      path: pathname,
      method: request.method,
      origin: request.headers.get("origin"),
    });
    // 403 with no detail. An attacker learns nothing about why.
    return applySecurityHeaders(
      new NextResponse("Forbidden", { status: 403 }),
      null,
    );
  }

  /* ── 2. Per-request nonce ─────────────────────────────────────────────── */

  const nonce = generateNonce();
  const csp = buildCsp(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  // Next.js reads the nonce out of this request header and stamps it onto the
  // framework's own <script> tags. Without it, the app would not boot under a
  // strict policy.
  requestHeaders.set("content-security-policy", csp);

  /* ── 3. CSRF token ────────────────────────────────────────────────────── */

  const existingCsrf = request.cookies.get(CSRF_COOKIE)?.value;
  // Re-mint when absent, malformed or expired, so a user who leaves a tab open
  // overnight is not silently rejected on submit.
  const csrfToken = (await verifyCsrfToken(existingCsrf))
    ? existingCsrf!
    : await createCsrfToken();
  const csrfIsNew = csrfToken !== existingCsrf;

  // Forwarded to the render so a server component can put it in a hidden field
  // — that is what lets the cookie stay HttpOnly.
  requestHeaders.set(CSRF_HEADER, csrfToken);

  // Signed "form served at" stamp for the bot-timing heuristic. Issued here so
  // the hidden field is populated server-side and the form still submits
  // without JavaScript.
  requestHeaders.set(FORM_TS_HEADER, await createTimestampToken());

  /* ── 4. Locale negotiation ────────────────────────────────────────────── */

  const pathLocale = getPathLocale(pathname);

  if (!pathLocale && !isExemptPath(pathname)) {
    const target = negotiateLocale(request);
    const url = request.nextUrl.clone();
    url.pathname = `/${target}${pathname === "/" ? "" : pathname}`;

    const redirect = NextResponse.redirect(url, 307);
    redirect.cookies.set(LOCALE_COOKIE, target, LOCALE_COOKIE_OPTIONS);
    if (csrfIsNew) redirect.cookies.set(CSRF_COOKIE, csrfToken, csrfCookieOptions);
    return applySecurityHeaders(redirect, csp);
  }

  /* ── 5. Pass through with headers attached ────────────────────────────── */

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  if (pathLocale && request.cookies.get(LOCALE_COOKIE)?.value !== pathLocale) {
    // Remember the locale the visitor actually landed on.
    response.cookies.set(LOCALE_COOKIE, pathLocale, LOCALE_COOKIE_OPTIONS);
  }

  if (csrfIsNew) {
    response.cookies.set(CSRF_COOKIE, csrfToken, csrfCookieOptions);
  }

  return applySecurityHeaders(response, csp);
}

/* ── Helpers ────────────────────────────────────────────────────────────── */

function applySecurityHeaders(
  response: NextResponse,
  csp: string | null,
): NextResponse {
  for (const [key, value] of Object.entries(staticSecurityHeaders())) {
    response.headers.set(key, value);
  }
  if (csp) response.headers.set(CSP_HEADER_NAME, csp);
  return response;
}

function getPathLocale(pathname: string): Locale | null {
  const segment = pathname.split("/")[1];
  return segment && isLocale(segment) ? segment : null;
}

/**
 * Endpoints called by machines, not browsers.
 *
 * The Origin/Referer check defends browser-driven state changes: a form posted
 * from evil.example carries evil.example's Origin. A server-to-server callback
 * carries NO Origin at all — Stripe's webhook is an HTTP request from Stripe's
 * infrastructure, not from a page — so applying the check here would 403 every
 * genuine payment confirmation while the signature verification that actually
 * secures the endpoint never ran.
 *
 * These endpoints are not unauthenticated as a result. `/api/payments/webhook`
 * is authenticated by an HMAC signature over the raw body plus a timestamp
 * tolerance, which is strictly stronger than an Origin header an attacker
 * could omit anyway. `/api/csp-report` only writes a log line, is rate
 * limited, size capped, and reflects nothing back.
 */
function isMachineEndpoint(pathname: string): boolean {
  return pathname === "/api/payments/webhook" || pathname === "/api/csp-report";
}

/** Paths that must not be locale-prefixed. */
function isExemptPath(pathname: string): boolean {
  return (
    pathname.startsWith("/api/") ||
    // The admin panel is organiser-facing and single-language; putting it
    // behind a locale prefix would mean translating it three ways for an
    // audience that shares one working language.
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    // Same reasoning for the judges' console: one working language, used by
    // the referee crew rather than by visitors.
    pathname === "/judge" ||
    pathname.startsWith("/judge/") ||
    // The coaches' cabinet is Russian-only for now, which is the one place
    // this reasoning is uncomfortable: a coach is a member of the public, and
    // the rest of the site speaks three languages to them. It sits here
    // because a signed-in cabinet is a working tool rather than a page the
    // event is advertised with, and because shipping it in one language beats
    // shipping it after the deadline. Revisit by moving these routes under
    // [locale] and translating the ~40 strings.
    pathname === "/coach" ||
    pathname.startsWith("/coach/") ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/favicon.ico"
  );
}

/**
 * Locale negotiation: explicit cookie choice wins, then Accept-Language, then
 * the default. Kazakhstan is bilingual and many Kazakh speakers browse with
 * `ru` first in their header, so the switcher is always visible in the header
 * regardless of what we guess here.
 */
function negotiateLocale(request: NextRequest): Locale {
  const cookie = request.cookies.get(LOCALE_COOKIE)?.value;
  if (cookie && isLocale(cookie)) return cookie;

  const header = request.headers.get("accept-language");
  if (header) {
    const preferences = header
      .split(",")
      .map((part) => {
        const [tag, ...params] = part.trim().split(";");
        const q = params.find((p) => p.trim().startsWith("q="));
        const quality = q ? Number.parseFloat(q.split("=")[1]) : 1;
        return { tag: tag.trim().toLowerCase(), quality: Number.isFinite(quality) ? quality : 0 };
      })
      // Cap the work an attacker can force with a pathological header.
      .slice(0, 20)
      .sort((a, b) => b.quality - a.quality);

    for (const { tag } of preferences) {
      const base = tag.split("-")[0];
      if (isLocale(base)) return base;
    }
  }

  return routing.defaultLocale;
}

export const config = {
  /**
   * Skip Next's internals and anything that looks like a static asset. The
   * proxy runs on every HTML request and every API route — which is where the
   * Origin check and the security headers actually matter.
   */
  matcher: [
    // `icon` and `apple-icon` are Next.js metadata routes and carry no file
    // extension, so without naming them above the locale rewrite sends /icon
    // to /ru/icon and the favicon 404s — silently, because a missing favicon
    // breaks nothing except how the site looks in a tab and in search results.
    //
    // Both are anchored with `$`. Unanchored, `icon` would also exclude
    // /iconfoo and everything else sharing the prefix, and anything excluded
    // here is served without the security headers this proxy exists to set.
    "/((?!_next/static|_next/image|icon$|apple-icon$|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|pdf|txt|xml|webmanifest|woff2?)$).*)",
  ],
};
