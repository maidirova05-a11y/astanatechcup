import "server-only";
import { env, features } from "@/lib/env";
import { logger } from "@/lib/log";
import { ENTRY_FEE } from "@/config/event";
import { createStripeCheckout, verifyStripeWebhook } from "./stripe";

/**
 * Payment abstraction.
 *
 * ── HARD RULE ────────────────────────────────────────────────────────────
 * This application never sees, transmits, logs or stores card data. There is
 * no card form in this codebase and there must never be one. The visitor is
 * redirected to the provider's own hosted checkout page, pays there, and comes
 * back. We keep an opaque transaction reference and a status, nothing else.
 *
 * That keeps the deployment in PCI-DSS SAQ A — the smallest possible scope —
 * and means a full compromise of this server still exposes no payment
 * instruments.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Stripe is the reference implementation. Kazakh acquiring is more likely to
 * run through Kaspi / ePay / RoboKassa; add an adapter next to `stripe.ts` that
 * satisfies the same two functions and switch on it below. Nothing outside
 * this folder needs to change.
 */

export type CheckoutRequest = {
  reference: string;
  /** Where to send the user after success / cancellation. Absolute URLs. */
  successUrl: string;
  cancelUrl: string;
  /** Prefilled on the provider's page; still typed by the payer there. */
  email: string;
  locale: string;
  teamName: string;
  discipline: string;
};

export type CheckoutResult =
  | { status: "redirect"; url: string }
  /** Provider not configured — the application is saved, payment deferred. */
  | { status: "unavailable" }
  | { status: "error" };

export type WebhookVerification =
  | { ok: true; eventId: string; type: string; reference: string | null; paymentReference: string }
  | { ok: false; reason: string };

export function isPaymentEnabled(): boolean {
  return features.payments;
}

export async function createCheckout(request: CheckoutRequest): Promise<CheckoutResult> {
  if (!features.payments) {
    logger.info("payment.unavailable", { reference: request.reference });
    return { status: "unavailable" };
  }

  try {
    const url = await createStripeCheckout(request, {
      amountMinor: ENTRY_FEE.minorUnits,
      currency: ENTRY_FEE.currency.toLowerCase(),
    });
    return { status: "redirect", url };
  } catch (error) {
    // A payment-provider outage must not lose the application — it is already
    // committed by the time we get here. Report an error and let the organisers
    // send a payment link manually.
    logger.error("payment.checkout_failed", { reference: request.reference, error });
    return { status: "error" };
  }
}

/**
 * Verify an incoming webhook. Signature verification is mandatory: without it,
 * anyone who learns the endpoint URL can mark any application as paid.
 */
export async function verifyWebhook(
  rawBody: string,
  signature: string | null,
): Promise<WebhookVerification> {
  if (!features.paymentWebhook) {
    return { ok: false, reason: "webhook_not_configured" };
  }
  return verifyStripeWebhook(rawBody, signature, env.STRIPE_WEBHOOK_SECRET!);
}
