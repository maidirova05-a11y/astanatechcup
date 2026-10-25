import { NextResponse, type NextRequest } from "next/server";
import { verifyWebhook } from "@/lib/payments";
import { getApplicationStore } from "@/lib/db/store";
import { logger, securityLog } from "@/lib/log";
import { normaliseReference } from "@/lib/reference";

/**
 * Payment webhook.
 *
 * This is the *only* path that may mark an application as paid. The browser
 * redirect back from the provider is cosmetic — it is user-controlled and
 * proves nothing, so `/payment/success` never mutates anything.
 *
 * Three guarantees, in order:
 *   1. Signature verified against the raw bytes (tampering / forgery).
 *   2. Timestamp tolerance inside the verifier (replay of a captured request).
 *   3. Event id recorded before acting (provider retries → exactly-once).
 */

// Signature verification needs the exact bytes as sent, so this route must run
// on Node with no body parsing or transformation in front of it.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Largest body accepted before the signature is checked. A Checkout Session
 * event is a few kilobytes; Stripe's own documented ceiling for an event is
 * well under this. Anything bigger is not Stripe, and reading it into memory
 * to then fail the HMAC is work an unauthenticated caller should not be able
 * to make this endpoint do.
 */
const MAX_BODY_BYTES = 512 * 1024;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    securityLog.webhookBodyTooLarge({ bytes: declared });
    return NextResponse.json({ error: "too large" }, { status: 413 });
  }

  // The raw body, decoded exactly as `request.text()` would. Parsing to JSON and
  // re-stringifying would change whitespace and key order, and the HMAC would
  // never match.
  const rawBody = await readBodyCapped(request, MAX_BODY_BYTES);
  if (rawBody === null) {
    // Chunked or lying Content-Length: the cap applies to what is received,
    // and reading stops at the cap rather than buffering the whole body first.
    securityLog.webhookBodyTooLarge({ overLimit: MAX_BODY_BYTES, streamed: true });
    return NextResponse.json({ error: "too large" }, { status: 413 });
  }
  const signature = request.headers.get("stripe-signature");

  const verification = await verifyWebhook(rawBody, signature);

  if (!verification.ok) {
    if (verification.reason.startsWith("ignored_event")) {
      // Not an error — acknowledge so the provider stops retrying.
      return NextResponse.json({ received: true, ignored: true });
    }
    if (verification.reason === "webhook_not_configured") {
      logger.warn("payment.webhook_not_configured");
      return NextResponse.json({ error: "not configured" }, { status: 503 });
    }
    // Signature problems are a security event, already logged by the verifier.
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const store = getApplicationStore();

  /**
   * Idempotency gate. Recording the event id *before* doing the work means a
   * retry that arrives while the first is still in flight loses the race and
   * exits, instead of double-processing.
   */
  const isNew = await store.recordWebhookEvent(
    verification.eventId,
    "stripe",
    verification.type,
  );

  if (!isNew) {
    logger.info("payment.webhook_duplicate", { eventId: verification.eventId });
    return NextResponse.json({ received: true, duplicate: true });
  }

  if (!verification.reference) {
    logger.error("payment.webhook_missing_reference", { eventId: verification.eventId });
    // 200: retrying will not add a reference that was never sent.
    return NextResponse.json({ received: true, unmatched: true });
  }

  // Never hand a provider-supplied string straight to a query.
  const reference = normaliseReference(verification.reference);
  if (!reference) {
    securityLog.webhookSignatureFailure({
      reason: "malformed_reference",
      eventId: verification.eventId,
    });
    return NextResponse.json({ received: true, unmatched: true });
  }

  let updated;
  try {
    updated = await store.markPaid(reference, verification.paymentReference);
  } catch (error) {
    /**
     * The update failed AFTER the event id was recorded. Left like this, the
     * provider's retry would be answered "duplicate" and the payment would
     * never be written — a team that has paid shown as unpaid on the day.
     * Release the id so the retry is processed, and answer 5xx so there IS a
     * retry. If the release itself fails the row stays and the log line below
     * is what an operator reconciles from.
     */
    logger.error("payment.webhook_mark_paid_failed", {
      reference,
      eventId: verification.eventId,
      message: error instanceof Error ? error.message : String(error),
    });
    try {
      await store.forgetWebhookEvent(verification.eventId);
    } catch (releaseError) {
      logger.error("payment.webhook_release_failed", {
        eventId: verification.eventId,
        message: releaseError instanceof Error ? releaseError.message : String(releaseError),
      });
    }
    return NextResponse.json({ error: "temporary" }, { status: 503 });
  }

  if (!updated) {
    // Either unknown, or already past pending_payment. Both are benign and
    // must not trigger an endless retry loop, so this is still a 200.
    logger.warn("payment.webhook_no_transition", {
      reference,
      eventId: verification.eventId,
    });
    return NextResponse.json({ received: true, unchanged: true });
  }

  logger.info("payment.confirmed", {
    reference,
    eventId: verification.eventId,
    discipline: updated.discipline,
  });

  return NextResponse.json({ received: true });
}

/**
 * Read the body as UTF-8 text, giving up (null) as soon as more than `max`
 * BYTES have arrived. `request.text()` would buffer an unbounded chunked body
 * before any length check could run.
 */
async function readBodyCapped(request: NextRequest, max: number): Promise<string | null> {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

/** Anything other than POST is a probe. */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ error: "method not allowed" }, { status: 405 });
}
