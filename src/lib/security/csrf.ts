import { csrfSecret, env, isProduction } from "@/lib/env";

/**
 * CSRF protection — synchroniser token + double-submit, belt and braces.
 *
 * How it works:
 *  1. `src/proxy.ts` mints a signed token on the first HTML request and stores
 *     it in an **HttpOnly** cookie.
 *  2. The same token is forwarded to the render via the `x-csrf-token` request
 *     header, so the server component can embed it in a hidden form field.
 *     Because the server writes the field, client JS never needs to read the
 *     cookie — which is why the cookie can stay HttpOnly, unlike a classic
 *     double-submit implementation.
 *  3. The server action requires: valid HMAC, not expired, and
 *     `field === cookie` compared in constant time.
 *
 * This runs *in addition to* Next.js's built-in Server Action origin check and
 * the explicit Origin/Referer verification in proxy.ts. Three independent
 * layers, because a single bypass in any one of them should not be enough.
 *
 * Edge-runtime safe: Web Crypto only, no node:crypto import.
 */

/**
 * The `__Host-` prefix is enforced by the browser, not by us: a cookie with
 * this name is rejected outright unless it is Secure, has `Path=/` and carries
 * no `Domain` attribute. That last part is what matters — it makes the cookie
 * un-settable by any subdomain, so a compromised `blog.astanatechcup.kz` (or a
 * stray preview deployment) cannot overwrite the CSRF token for the main site.
 *
 * It requires HTTPS, so plain `atc.csrf` is used on localhost.
 */
export const CSRF_COOKIE = isProduction ? "__Host-atc.csrf" : "atc.csrf";

// Re-exported for server-side callers. Client components must import these
// from `@/lib/security/constants` directly — importing them from here would
// drag `@/lib/env` into the browser bundle. See the note in that file.
export { CSRF_FIELD, CSRF_HEADER, FORM_TS_HEADER } from "./constants";

/** Tokens outlive a long form fill but not a stolen laptop. */
const TOKEN_TTL_MS = 8 * 60 * 60 * 1000;

const encoder = new TextEncoder();

let keyPromise: Promise<CryptoKey> | null = null;

function getKey(): Promise<CryptoKey> {
  keyPromise ??= crypto.subtle.importKey(
    "raw",
    encoder.encode(csrfSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
  return keyPromise;
}

function toBase64Url(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (const byte of view) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sign(payload: string): Promise<string> {
  const signature = await crypto.subtle.sign("HMAC", await getKey(), encoder.encode(payload));
  return toBase64Url(signature);
}

/**
 * Constant-time string comparison. `a === b` short-circuits on the first
 * differing byte and leaks token content through timing.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  // Compare a fixed number of bytes so length alone does not branch timing.
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);
  const length = Math.max(aBytes.length, bBytes.length);
  let diff = aBytes.length ^ bBytes.length;
  for (let i = 0; i < length; i++) {
    diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }
  return diff === 0;
}

/** `<random>.<issuedAt>.<hmac>` */
export async function createCsrfToken(): Promise<string> {
  const random = new Uint8Array(24);
  crypto.getRandomValues(random);
  const payload = `${toBase64Url(random)}.${Date.now()}`;
  return `${payload}.${await sign(payload)}`;
}

export async function verifyCsrfToken(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;

  const parts = token.split(".");
  if (parts.length !== 3) return false;

  const [random, issuedAt, signature] = parts;
  if (!random || !issuedAt || !signature) return false;

  const expected = await sign(`${random}.${issuedAt}`);
  if (!timingSafeEqual(signature, expected)) return false;

  const issued = Number(issuedAt);
  if (!Number.isFinite(issued)) return false;
  // Reject future-dated tokens too — a clock-skew or forgery signal.
  if (issued > Date.now() + 60_000) return false;
  if (Date.now() - issued > TOKEN_TTL_MS) return false;

  return true;
}

/**
 * Full check for a state-changing request: the submitted token must be
 * authentic AND match the one bound to this browser's cookie.
 */
export async function assertCsrf(
  submitted: string | undefined | null,
  cookieValue: string | undefined | null,
): Promise<boolean> {
  if (!submitted || !cookieValue) return false;
  if (!timingSafeEqual(submitted, cookieValue)) return false;
  return verifyCsrfToken(submitted);
}

/* ── Signed form-render timestamp ───────────────────────────────────────── */

/**
 * A signed "this form was served at" stamp, minted per request in the proxy
 * and rendered into a hidden field.
 *
 * Why signed and server-issued rather than written by client JavaScript:
 *   · the field is present even before hydration, so the form still submits
 *     with JavaScript disabled or still loading;
 *   · a bot cannot forge an older timestamp to fake having "spent time" on
 *     the form — it would have to request the page and actually wait.
 */
export async function createTimestampToken(now: number = Date.now()): Promise<string> {
  const payload = String(now);
  return `${payload}.${await sign(payload)}`;
}

/** Returns the issue time in epoch ms, or null if absent/forged/malformed. */
export async function readTimestampToken(
  token: string | undefined | null,
): Promise<number | null> {
  if (!token) return null;

  const separator = token.lastIndexOf(".");
  if (separator <= 0) return null;

  const payload = token.slice(0, separator);
  const signature = token.slice(separator + 1);

  const expected = await sign(payload);
  if (!timingSafeEqual(signature, expected)) return null;

  const issued = Number(payload);
  return Number.isFinite(issued) ? issued : null;
}

export const csrfCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: isProduction,
  path: "/",
  maxAge: TOKEN_TTL_MS / 1000,
};

/**
 * Origin / Referer verification — the second layer, independent of tokens.
 *
 * A cross-site form post from evil.example carries its own Origin, which will
 * not match APP_URL. Requests with neither header are rejected outright:
 * every real browser sends Origin on POST.
 */
export function isSameOrigin(request: {
  headers: { get(name: string): string | null };
  nextUrl?: { origin: string };
}): boolean {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");

  const allowed = new Set<string>([env.APP_URL]);
  // The runtime origin covers preview deployments and local ports, where
  // APP_URL is not necessarily what the browser actually connected to.
  if (request.nextUrl?.origin) allowed.add(request.nextUrl.origin);

  if (origin) return allowed.has(origin);

  if (referer) {
    try {
      return allowed.has(new URL(referer).origin);
    } catch {
      return false;
    }
  }

  return false;
}
