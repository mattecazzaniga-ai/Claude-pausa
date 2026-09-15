import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isStripeConfigured, createCheckoutSessionForPurchase } from "@/lib/stripe";
import { captureError } from "@/lib/monitoring";

/**
 * (Re)generates a shareable Stripe Checkout link for an existing pending
 * online payment — the coach copies this and sends it to the athlete
 * (WhatsApp, email, SMS...) instead of paying it themselves. A fresh
 * Checkout Session is created each time this is called (Stripe's own
 * sessions expire after 24h), reusing the same Purchase/Payment rows so
 * this never creates a duplicate purchase.
 */
export async function POST(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isStripeConfigured) {
    return NextResponse.json({ error: "I pagamenti online non sono configurati su questo ambiente." }, { status: 503 });
  }

  const payment = await prisma.payment.findUnique({
    where: { id: params.id },
    include: { purchase: { include: { offer: true, athlete: { select: { name: true } } } } },
  });
  if (!payment || payment.purchase.coachId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (payment.method !== "ONLINE") {
    return NextResponse.json({ error: "Questo pagamento non è online." }, { status: 409 });
  }
  if (payment.status !== "PENDING") {
    return NextResponse.json({ error: "Questo pagamento non è più in attesa." }, { status: 409 });
  }

  try {
    const { url } = await createCheckoutSessionForPurchase({
      offer: payment.purchase.offer,
      purchaseId: payment.purchase.id,
      paymentId: payment.id,
      athleteName: payment.purchase.athlete.name,
    });
    return NextResponse.json({ checkoutUrl: url });
  } catch (err) {
    captureError("Checkout link regeneration failed", err, { paymentId: payment.id });
    return NextResponse.json({ error: "Impossibile generare il link di pagamento. Riprova tra poco." }, { status: 502 });
  }
}
