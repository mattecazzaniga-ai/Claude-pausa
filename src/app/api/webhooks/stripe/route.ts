import { NextResponse } from "next/server";
import { stripe } from "@/lib/payments";
import { finalizePurchase } from "@/lib/purchase";

/**
 * Real Stripe webhook. Only reachable in a meaningful way once STRIPE_SECRET_KEY
 * and STRIPE_WEBHOOK_SECRET are configured — otherwise signature verification
 * always fails, which is the correct behavior (nothing should be trusted
 * without a verified signature).
 */
export async function POST(req: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !webhookSecret) {
    return NextResponse.json({ error: "Stripe is not configured on this deployment." }, { status: 501 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  const body = await req.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("Stripe webhook signature verification failed", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as { metadata?: Record<string, string>; payment_intent?: string };
    const transactionId = session.metadata?.transactionId;
    if (transactionId) {
      const result = await finalizePurchase(transactionId, {
        stripePaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : undefined,
      });
      if (!result.ok) {
        console.error("Failed to finalize purchase from webhook", transactionId, result.reason);
      }
    }
  }

  return NextResponse.json({ received: true });
}
