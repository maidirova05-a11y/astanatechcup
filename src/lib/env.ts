import { z } from "zod";

/**
 * Validated environment. Import `env` — never `process.env` — anywhere else.
 *
 * Design rules:
 *  · Every integration is OPTIONAL. The site boots and the form works with an
 *    empty .env, so a designer can run it without credentials. Each capability
 *    reports its own availability through the `features` object below.
 *  · Secrets are validated at startup, so a typo fails loudly at boot rather
 *    than silently disabling CSRF protection at 3am on deadline day.
 *  · In production the guards are hard errors. In development they degrade to
 *    warnings, because a missing Stripe key must not block UI work.
 */

const isProd = process.env.NODE_ENV === "production";

/**
 * A password hash from `npm run admin:hash`, in either separator form.
 *
 * Matched with a regex rather than `startsWith`, so a value that a `.env`
 * loader has quietly eaten the `$` signs out of fails at boot with a clear
 * message instead of silently never matching any password.
 */
const SCRYPT_HASH = /^scrypt[.$]\d+[.$]\d+[.$]\d+[.$][A-Za-z0-9+/=]+[.$][A-Za-z0-9+/=]+$/;
const SCRYPT_HASH_MESSAGE =
  "must be a full hash from `npm run admin:hash`, e.g. scrypt.131072.8.1.<salt>.<hash>";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  /**
   * Canonical public origin, e.g. https://astanatechcup.kz
   * Used for: CSRF Origin comparison, absolute URLs in metadata, and the
   * payment provider's return URLs. Must NOT have a trailing slash.
   */
  APP_URL: z
    .string()
    .url()
    .refine((v) => !v.endsWith("/"), "APP_URL must not have a trailing slash")
    .default("http://localhost:3000"),

  /**
   * HMAC key for CSRF tokens. Generate with:
   *   node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
   */
  CSRF_SECRET: z.string().min(32).optional(),

  /** Postgres connection string. Absent => in-memory store (dev only). */
  DATABASE_URL: z.string().url().optional(),

  /**
   * 32-byte AES key, base64. Encrypts personal data at rest — the member
   * roster, contact name, email, phone and comment.
   *
   * Generate with `npm run keygen`.
   *
   * ⚠ LOSING THIS KEY MEANS LOSING EVERY REGISTRATION. It is not recoverable
   * from the database, because that is the entire point. Back it up somewhere
   * that is not the database and not this repository.
   *
   * ⚠ CHANGING IT makes existing rows undecryptable. Rotation needs a
   * re-encryption pass, which the `v1.` envelope prefix is there to support.
   */
  ENCRYPTION_KEY: z.string().min(1).optional(),

  /**
   * scrypt hash of the shared admin password, produced by `npm run admin:hash`.
   * Absent => the admin panel is disabled entirely and /admin returns 404.
   * The plaintext password is never stored, transmitted or logged anywhere.
   *
   * `scrypt.` is the current format; `scrypt$` is accepted for hashes minted
   * before the separator changed. See the note in src/lib/admin/password.ts —
   * the short version is that a `$` does not survive a .env file.
   */
  ADMIN_PASSWORD_HASH: z.string().regex(SCRYPT_HASH, SCRYPT_HASH_MESSAGE).optional(),

  /**
   * scrypt hash of the shared JUDGES' password, produced the same way:
   *   npm run admin:hash
   *
   * A judge session can reach the scoring console and nothing else — no
   * applications, no personal data, no export. Absent => there is no separate
   * judges' sign-in and only the organising committee can file results.
   *
   * Make it a DIFFERENT password from ADMIN_PASSWORD_HASH. The point of the
   * split is that a password shared with twenty referees at a venue is a
   * password that will be overheard, and it must not be the one that opens the
   * panel holding children's names and ages.
   */
  JUDGE_PASSWORD_HASH: z.string().regex(SCRYPT_HASH, SCRYPT_HASH_MESSAGE).optional(),

  /** Cloudflare Turnstile. Both halves required, or the feature stays off. */
  TURNSTILE_SECRET_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().min(1).optional(),

  /** Stripe hosted Checkout. We never touch card data — redirect only. */
  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),

  /**
   * Header carrying the real client IP, set by YOUR proxy. Getting this wrong
   * means either rate-limiting everyone as one IP, or letting an attacker
   * bypass limits by forging the header. Vercel: x-vercel-forwarded-for.
   * Cloudflare: cf-connecting-ip. Bare nginx: whatever you configure.
   */
  TRUSTED_IP_HEADER: z.string().default("x-forwarded-for"),

  /** Plausible / analytics host. Absent => no analytics script at all. */
  NEXT_PUBLIC_ANALYTICS_DOMAIN: z.string().min(1).optional(),
  NEXT_PUBLIC_ANALYTICS_SRC: z.string().url().optional(),

  /** Set to "1" to send CSP violations to /api/csp-report instead of enforcing. */
  CSP_REPORT_ONLY: z.enum(["0", "1"]).default("0"),
});

/**
 * Every variable is referenced by its literal name rather than by spreading
 * `process.env`. Next.js inlines `process.env.FOO` at build time, and in the
 * Edge runtime (where src/proxy.ts runs) a dynamic lookup would come back
 * undefined — silently disabling CSRF instead of failing loudly.
 */
const rawEnv: Record<string, string | undefined> = {
  NODE_ENV: process.env.NODE_ENV,
  APP_URL: process.env.APP_URL,
  CSRF_SECRET: process.env.CSRF_SECRET,
  DATABASE_URL: process.env.DATABASE_URL,
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
  ADMIN_PASSWORD_HASH: process.env.ADMIN_PASSWORD_HASH,
  JUDGE_PASSWORD_HASH: process.env.JUDGE_PASSWORD_HASH,
  TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY,
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  TRUSTED_IP_HEADER: process.env.TRUSTED_IP_HEADER,
  NEXT_PUBLIC_ANALYTICS_DOMAIN: process.env.NEXT_PUBLIC_ANALYTICS_DOMAIN,
  NEXT_PUBLIC_ANALYTICS_SRC: process.env.NEXT_PUBLIC_ANALYTICS_SRC,
  CSP_REPORT_ONLY: process.env.CSP_REPORT_ONLY,
};

// Treat empty strings as absent — a blank line in .env should mean "not set",
// not "set to the empty string", which would defeat the .optional() checks.
for (const key of Object.keys(rawEnv)) {
  if (rawEnv[key] === "") rawEnv[key] = undefined;
}

const parsed = schema.safeParse(rawEnv);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  · ${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("\n");
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

export const env = parsed.data;

/**
 * Capability flags. Components and server code branch on these rather than
 * checking for the presence of individual keys, so "half-configured" is not a
 * reachable state.
 */
export const features = {
  database: Boolean(env.DATABASE_URL),
  // The panel needs both: somewhere to read applications from, and a way to
  // authenticate. Half-configured means off, not partly on.
  admin: Boolean(env.DATABASE_URL && env.ADMIN_PASSWORD_HASH),
  /**
   * The scoring console and the public results page. Needs somewhere to store
   * results and at least one password that can reach the console — an admin
   * one counts, so a small event can run without issuing a separate judges'
   * password at all.
   */
  scoring: Boolean(
    env.DATABASE_URL && (env.ADMIN_PASSWORD_HASH || env.JUDGE_PASSWORD_HASH),
  ),
  /** Whether a separate judges' sign-in exists at all. */
  judgeLogin: Boolean(env.DATABASE_URL && env.JUDGE_PASSWORD_HASH),
  /**
   * The coaches' cabinet.
   *
   * Needs only a database, because unlike the operator surfaces it has no
   * shared password to configure: every coach's credential is a row, created
   * by that coach against their own entry. Encryption is not listed as a
   * second condition because production cannot boot without ENCRYPTION_KEY
   * anyway, and in development crypto/field.ts falls back to a fixed key.
   */
  coach: Boolean(env.DATABASE_URL),
  turnstile: Boolean(env.TURNSTILE_SECRET_KEY && env.NEXT_PUBLIC_TURNSTILE_SITE_KEY),
  payments: Boolean(env.STRIPE_SECRET_KEY),
  paymentWebhook: Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET),
  analytics: Boolean(env.NEXT_PUBLIC_ANALYTICS_DOMAIN && env.NEXT_PUBLIC_ANALYTICS_SRC),
} as const;

/**
 * Production readiness gate. A landing page that silently loses registrations
 * because DATABASE_URL was never set is worse than one that refuses to boot.
 */
const PRODUCTION_REQUIRED: Array<[boolean, string]> = [
  [Boolean(env.CSRF_SECRET), "CSRF_SECRET is required in production"],
  [
    Boolean(env.ENCRYPTION_KEY),
    "ENCRYPTION_KEY is required in production — personal data must not be written in the clear",
  ],
  [features.database, "DATABASE_URL is required in production — applications would otherwise be lost on restart"],
  [env.APP_URL.startsWith("https://"), "APP_URL must be https:// in production"],
];

/**
 * `next build` runs with NODE_ENV=production, but a build is not a boot: CI
 * has no database URL and should not need production secrets to compile a
 * page. Next sets NEXT_PHASE during the build, which is how we tell the two
 * apart. The gate still fires on the first real request in production.
 */
const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";

if (isProd && !isBuildPhase) {
  const missing = PRODUCTION_REQUIRED.filter(([ok]) => !ok).map(([, msg]) => msg);
  if (missing.length > 0) {
    throw new Error(
      `Refusing to start in production:\n${missing.map((m) => `  · ${m}`).join("\n")}`,
    );
  }
}

/**
 * Development-only fallback secret. Deterministic so tokens survive a hot
 * reload, and never used when NODE_ENV=production (guarded above).
 */
export const csrfSecret =
  env.CSRF_SECRET ?? "dev-only-insecure-csrf-secret-do-not-use-in-production";

export const isProduction = isProd;
export const isDevelopment = env.NODE_ENV === "development";
