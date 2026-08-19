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

export async function POST(request: NextRequest): Promise<NextResponse> {
  // `request.text()` preserves the raw body. Parsing to JSON and re-stringifying
  // would change whitespace and key order, and the HMAC would never match.
  const rawBody = await request.text();
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

  const updated = await store.markPaid(reference, verification.paymentReference);

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

/** Anything other than POST is a probe. */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ error: "method not allowed" }, { status: 405 });
}
