import "server-only";
import Stripe from "stripe";
import { env } from "@/lib/env";
import { securityLog } from "@/lib/log";
import type { CheckoutRequest, WebhookVerification } from "./index";

/**
 * Stripe hosted Checkout adapter.
 *
 * `mode: "payment"` + `ui_mode: "hosted"` means Stripe renders the card form on
 * its own domain. Our origin never receives a PAN, so no part of this file can
 * leak one.
 */

let stripe: Stripe | null = null;

function getStripe(): Stripe {
  if (!stripe) {
    stripe = new Stripe(env.STRIPE_SECRET_KEY!, {
      // Pin the API version. An unpinned client silently changes behaviour
      // when Stripe ships a new version, which is not something you want to
      // discover through a payment bug on deadline day.
      apiVersion: "2026-07-29.dahlia",
      maxNetworkRetries: 2,
      timeout: 10_000,
      telemetry: false,
    });
  }
  return stripe;
}

/** Stripe supports a fixed locale list; anything else must fall back. */
function toStripeLocale(locale: string): Stripe.Checkout.SessionCreateParams.Locale {
  if (locale === "ru") return "ru";
  if (locale === "en") return "en";
  // Stripe has no Kazakh locale. Russian is the closest option in-market and
  // strictly better than dropping a Kazakh speaker onto an English page.
  if (locale === "kk") return "ru";
  return "auto";
}

export async function createStripeCheckout(
  request: CheckoutRequest,
  money: { amountMinor: number; currency: string },
): Promise<string> {
  const session = await getStripe().checkout.sessions.create(
    {
      mode: "payment",
      ui_mode: "hosted",
      locale: toStripeLocale(request.locale),

      success_url: request.successUrl,
      cancel_url: request.cancelUrl,

      customer_email: request.email,

      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: money.currency,
            unit_amount: money.amountMinor,
            product_data: {
              name: `AstanaTechCup — ${request.discipline}`,
              description: `Registration fee · team ${request.teamName}`,
            },
          },
        },
      ],

      /**
       * The application reference travels with the payment. It is the only
       * link between a Stripe session and our row, and it is what the webhook
       * reads back. `client_reference_id` is echoed on every event.
       */
      client_reference_id: request.reference,
      metadata: { reference: request.reference },

      // Stale checkout sessions become confusing "did I pay?" support tickets.
      expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
    },
    {
      /**
       * Idempotency key. A double-click, a retried request or a flaky network
       * must not create two charges for one team. Stripe returns the original
       * session for a repeated key.
       */
      idempotencyKey: `checkout:${request.reference}`,
    },
  );

  if (!session.url) throw new Error("Stripe returned a session without a URL");
  return session.url;
}

/**
 * Verify the `Stripe-Signature` header against the raw request body.
 *
 * Two things matter and both are handled by `constructEvent`:
 *   · HMAC over the exact bytes we received — hence the raw string, never a
 *     re-serialised JSON object.
 *   · Timestamp tolerance, which is what blocks replay of a captured webhook.
 */
export async function verifyStripeWebhook(
  rawBody: string,
  signature: string | null,
  secret: string,
): Promise<WebhookVerification> {
  if (!signature) {
    securityLog.webhookSignatureFailure({ reason: "missing_signature" });
    return { ok: false, reason: "missing_signature" };
  }

  let event: Stripe.Event;
  try {
    event = await getStripe().webhooks.constructEventAsync(
      rawBody,
      signature,
      secret,
      // Five minutes. Anything older is a replay, not a slow network.
      300,
    );
  } catch (error) {
    securityLog.webhookSignatureFailure({
      reason: "invalid_signature",
      error: error instanceof Error ? error.message : "unknown",
    });
    return { ok: false, reason: "invalid_signature" };
  }

  // Only one event type advances an application to paid.
  if (event.type !== "checkout.session.completed") {
    return { ok: false, reason: `ignored_event:${event.type}` };
  }

  const session = event.data.object as Stripe.Checkout.Session;

  // Belt and braces: an unpaid session must never mark the row paid, even if
  // Stripe delivers the completion event for an async payment method.
  if (session.payment_status !== "paid") {
    return { ok: false, reason: `unpaid_session:${session.payment_status}` };
  }

  return {
    ok: true,
    eventId: event.id,
    type: event.type,
    reference: session.client_reference_id ?? session.metadata?.reference ?? null,
    paymentReference: session.payment_intent
      ? String(session.payment_intent)
      : session.id,
  };
}
