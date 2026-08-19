import { env, features } from "@/lib/env";
import { securityLog } from "@/lib/log";

/**
 * Cloudflare Turnstile verification.
 *
 * Chosen over reCAPTCHA because the audience includes six-year-olds and their
 * parents: Turnstile is usually invisible, has no image puzzles to fail, and
 * does not feed the visitor into an advertising graph.
 *
 * When Turnstile is not configured the site still has two bot defences that
 * need no third party: the honeypot field and the submission-timing check
 * below. They are weaker but free, and they run in every deployment.
 */

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

type TurnstileResponse = {
  success: boolean;
  "error-codes"?: string[];
  challenge_ts?: string;
  hostname?: string;
};

export async function verifyTurnstile(
  token: string | undefined | null,
  remoteIp: string,
): Promise<boolean> {
  // Not configured — this check is a no-op and the honeypot carries the load.
  if (!features.turnstile) return true;

  if (!token) {
    securityLog.captchaFailure({ reason: "missing_token" });
    return false;
  }

  try {
    const body = new URLSearchParams({
      secret: env.TURNSTILE_SECRET_KEY!,
      response: token,
    });
    // Only forward a real address; "unknown" would be rejected by the API.
    if (remoteIp && remoteIp !== "unknown") body.set("remoteip", remoteIp);

    const response = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      // Never let a slow third party hold a request open indefinitely.
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      securityLog.captchaFailure({ reason: "http_error", status: response.status });
      return false;
    }

    const result = (await response.json()) as TurnstileResponse;

    if (!result.success) {
      securityLog.captchaFailure({ reason: "rejected", codes: result["error-codes"] });
      return false;
    }

    return true;
  } catch (error) {
    securityLog.captchaFailure({ reason: "exception", error });
    // Fail CLOSED. If we cannot verify the visitor is human, we do not accept
    // the submission. A brief Cloudflare outage costs a few registrations;
    // failing open costs a spam-filled database at the worst possible moment.
    return false;
  }
}

/* ── Third-party-free bot defences ──────────────────────────────────────── */

// Field names live in `./constants` (no imports) so client components can use
// them without dragging `@/lib/env` into the browser bundle.
export { HONEYPOT_FIELD, FORM_TIMESTAMP_FIELD } from "./constants";

/** Nobody reads a multi-section form and fills it honestly in three seconds. */
const MIN_FILL_MS = 3000;
/** Older than this and the token is stale — likely a replayed capture. */
const MAX_FILL_MS = 6 * 60 * 60 * 1000;

export type BotCheckResult = { ok: true } | { ok: false; reason: string };

export function checkHoneypot(value: unknown): BotCheckResult {
  if (typeof value === "string" && value.trim().length > 0) {
    return { ok: false, reason: "honeypot_filled" };
  }
  return { ok: true };
}

/**
 * @param loadedAt Epoch ms already recovered from the SIGNED token by
 *   `readTimestampToken`. Passing a raw client-supplied number here would let
 *   a bot claim any age it likes.
 */
export function checkTiming(
  loadedAt: number | null,
  now: number = Date.now(),
): BotCheckResult {
  // Absent or failed signature check — the form was not served by us.
  if (loadedAt === null || !Number.isFinite(loadedAt)) {
    return { ok: false, reason: "timestamp_missing" };
  }

  const elapsed = now - loadedAt;
  if (elapsed < 0) return { ok: false, reason: "timestamp_future" };
  if (elapsed < MIN_FILL_MS) return { ok: false, reason: "too_fast" };
  if (elapsed > MAX_FILL_MS) return { ok: false, reason: "too_old" };

  return { ok: true };
}
