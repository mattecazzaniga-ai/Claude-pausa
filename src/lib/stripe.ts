import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import type { Offer } from "@prisma/client";

const secretKey = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

/** The rest of the app can check this to show a clear "online payments not configured" state instead of failing silently. */
export const isStripeConfigured = Boolean(secretKey);

const stripe = secretKey ? new Stripe(secretKey) : null;

function requireStripe() {
  if (!stripe) throw new Error("Stripe not configured: STRIPE_SECRET_KEY is missing.");
  return stripe;
}

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

/**
 * Lazily creates a Stripe Product+Price for an offer the first time it's
 * sold online, then caches the Price id on the offer — an offer that's only
 * ever sold offline never touches the Stripe API (mirrors the lazy
 * sport-profile/taxonomy generation pattern used elsewhere in this app).
 */
async function getOrCreateStripePriceId(offer: Offer): Promise<string> {
  const client = requireStripe();
  if (offer.stripePriceId) return offer.stripePriceId;

  const price = await client.prices.create({
    currency: offer.currency.toLowerCase(),
    unit_amount: offer.priceCents,
    product_data: { name: offer.name },
    ...(offer.type === "SUBSCRIPTION"
      ? { recurring: { interval: offer.billingFrequency === "WEEKLY" ? "week" : "month" } }
      : {}),
  });

  await prisma.offer.update({ where: { id: offer.id }, data: { stripePriceId: price.id } });

  return price.id;
}

/**
 * Creates a hosted Stripe Checkout session for one purchase. The frontend
 * never handles card data or decides payment success — Checkout does, and
 * the webhook is the only thing allowed to mark a Payment as PAID (§20).
 */
export async function createCheckoutSessionForPurchase(params: {
  offer: Offer;
  purchaseId: string;
  paymentId: string;
  athleteName: string;
}): Promise<{ url: string }> {
  const client = requireStripe();
  const priceId = await getOrCreateStripePriceId(params.offer);

  const session = await client.checkout.sessions.create({
    mode: params.offer.type === "SUBSCRIPTION" ? "subscription" : "payment",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl()}/payments?checkout=success`,
    cancel_url: `${appUrl()}/payments?checkout=cancelled`,
    client_reference_id: params.purchaseId,
    metadata: { purchaseId: params.purchaseId, paymentId: params.paymentId },
    ...(params.offer.type !== "SUBSCRIPTION" ? { payment_intent_data: { metadata: { purchaseId: params.purchaseId, paymentId: params.paymentId } } } : {}),
  });

  if (!session.url) throw new Error("Stripe did not return a checkout URL");

  await prisma.payment.update({ where: { id: params.paymentId }, data: { stripeCheckoutSessionId: session.id } });

  return { url: session.url };
}

/** Verifies a webhook's signature — never trust an unverified event (§20). */
export function constructWebhookEvent(rawBody: string, signature: string): Stripe.Event {
  const client = requireStripe();
  if (!webhookSecret) throw new Error("Stripe webhook not configured: STRIPE_WEBHOOK_SECRET is missing.");
  return client.webhooks.constructEvent(rawBody, signature, webhookSecret);
}
