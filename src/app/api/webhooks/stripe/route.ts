import { NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { constructWebhookEvent } from "@/lib/stripe";
import { track } from "@/lib/analytics";
import { captureError } from "@/lib/monitoring";

/**
 * The only place a Payment is ever allowed to become PAID for an online
 * purchase (§20/§43) — never the frontend. Every handler here is written to
 * be safely re-run on a duplicate delivery: Stripe retries webhooks, so
 * idempotency is a requirement, not a nice-to-have.
 */
export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = constructWebhookEvent(rawBody, signature);
  } catch (err) {
    captureError("Stripe webhook signature verification failed", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const checkoutSession = event.data.object as Stripe.Checkout.Session;
        const paymentId = checkoutSession.metadata?.paymentId;
        if (!paymentId) break;

        // Idempotent by construction: only rows still PENDING are updated,
        // so a duplicate delivery of the same event is a harmless no-op.
        const result = await prisma.payment.updateMany({
          where: { id: paymentId, status: "PENDING" },
          data: {
            status: "PAID",
            paidAt: new Date(),
            stripePaymentIntentId:
              typeof checkoutSession.payment_intent === "string" ? checkoutSession.payment_intent : checkoutSession.payment_intent?.id,
          },
        });

        if (result.count > 0) {
          const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
          if (payment) {
            await prisma.purchase.update({ where: { id: payment.purchaseId }, data: { status: "ACTIVE" } });
          }
        }
        break;
      }

      case "checkout.session.expired": {
        const checkoutSession = event.data.object as Stripe.Checkout.Session;
        const paymentId = checkoutSession.metadata?.paymentId;
        if (!paymentId) break;
        await prisma.payment.updateMany({ where: { id: paymentId, status: "PENDING" }, data: { status: "CANCELLED" } });
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const paymentIntentId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
        if (!paymentIntentId) break;

        const payment = await prisma.payment.findUnique({ where: { stripePaymentIntentId: paymentIntentId } });
        if (payment && payment.status !== "REFUNDED") {
          await prisma.payment.update({ where: { id: payment.id }, data: { status: "REFUNDED" } });
          await prisma.purchase.update({ where: { id: payment.purchaseId }, data: { status: "CANCELLED" } });
        }
        break;
      }

      default:
        break;
    }
  } catch (err) {
    captureError("Stripe webhook handler failed", err, { eventType: event.type });
    return NextResponse.json({ error: "Webhook handler error" }, { status: 500 });
  }

  track("stripe_webhook_processed", null, { type: event.type });

  return NextResponse.json({ received: true });
}
