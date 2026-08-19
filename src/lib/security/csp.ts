import { env, features, isDevelopment } from "@/lib/env";

/**
 * Content-Security-Policy, built per request around a fresh nonce.
 *
 * The policy is assembled from the *enabled* integrations rather than written
 * as one static string. If Turnstile is not configured, its origin never
 * appears in the policy at all — the attack surface tracks the actual
 * deployment instead of the maximal one.
 */

// Defined in `./constants` (no imports) so the client can reference it without
// pulling this module — and therefore `@/lib/env` — into the browser bundle.
export { TURNSTILE_ORIGIN } from "./constants";
import { TURNSTILE_ORIGIN } from "./constants";

/** Cryptographically random, base64, fresh for every HTML response. */
export function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function buildCsp(nonce: string): string {
  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    // With strict-dynamic, a nonce-approved script may load further scripts.
    // Next.js's runtime needs this to bootstrap its chunks. Host allow-lists
    // are ignored by browsers that honour strict-dynamic, which is the point:
    // no "https:" wildcard can be smuggled past it.
    "'strict-dynamic'",
    // Ignored by CSP3 browsers (strict-dynamic wins); kept as the CSP2 fallback.
    "https:",
  ];

  if (isDevelopment) {
    // React Refresh and the Next dev overlay compile in the browser.
    // Never present in a production response.
    scriptSrc.push("'unsafe-eval'");
  }

  const connectSrc = ["'self'"];
  const frameSrc = ["'self'"];

  if (features.turnstile) {
    // Turnstile renders its challenge in an iframe and calls home to verify.
    frameSrc.push(TURNSTILE_ORIGIN);
    connectSrc.push(TURNSTILE_ORIGIN);
  }

  if (features.analytics && env.NEXT_PUBLIC_ANALYTICS_SRC) {
    connectSrc.push(new URL(env.NEXT_PUBLIC_ANALYTICS_SRC).origin);
  }

  if (isDevelopment) {
    // HMR websocket.
    connectSrc.push("ws:", "wss:");
  }

  const directives: Record<string, string[] | null> = {
    "default-src": ["'self'"],
    "script-src": scriptSrc,
    // 'unsafe-inline' for styles only — a documented, deliberate trade-off.
    // Framer Motion animates via the `style` attribute and Next injects
    // critical CSS inline; neither can carry a nonce. Inline *style* is a far
    // weaker vector than inline script, and script-src stays strict.
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:"],
    // next/font self-hosts everything, so no third-party font origin is needed.
    "font-src": ["'self'", "data:"],
    "connect-src": connectSrc,
    "media-src": ["'self'"],
    "frame-src": frameSrc,
    "worker-src": ["'self'", "blob:"],
    "manifest-src": ["'self'"],
    // No <object>/<embed> anywhere on this site.
    "object-src": ["'none'"],
    // Stops a dangling-markup injection from re-pointing relative URLs.
    "base-uri": ["'self'"],
    // Clickjacking defence that also covers browsers ignoring X-Frame-Options.
    "frame-ancestors": ["'none'"],
    // An injected <form> cannot exfiltrate to an attacker's endpoint.
    "form-action": ["'self'"],
    "upgrade-insecure-requests": isDevelopment ? null : [],
  };

  if (env.CSP_REPORT_ONLY === "1") {
    directives["report-uri"] = ["/api/csp-report"];
    directives["report-to"] = ["csp-endpoint"];
  }

  return Object.entries(directives)
    .filter(([, value]) => value !== null)
    .map(([key, value]) => (value!.length ? `${key} ${value!.join(" ")}` : key))
    .join("; ");
}

export const CSP_HEADER_NAME =
  env.CSP_REPORT_ONLY === "1"
    ? "Content-Security-Policy-Report-Only"
    : "Content-Security-Policy";

/**
 * Request-independent hardening. `Permissions-Policy` is set in next.config.ts
 * instead, because it never varies per request.
 */
export function staticSecurityHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    // Stop MIME sniffing turning an uploaded .txt into executable script.
    "X-Content-Type-Options": "nosniff",
    // Legacy clickjacking defence; frame-ancestors above is the modern one.
    "X-Frame-Options": "DENY",
    // Never leak a full URL (which may contain an application reference) to
    // another origin.
    "Referrer-Policy": "strict-origin-when-cross-origin",
    // Cut this document off from cross-origin window handles.
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
    "X-DNS-Prefetch-Control": "off",
  };

  if (!isDevelopment) {
    // Two years, subdomains included, preload-list eligible.
    // Only ever sent over HTTPS — setting it in dev would poison localhost.
    headers["Strict-Transport-Security"] =
      "max-age=63072000; includeSubDomains; preload";
  }

  return headers;
}
