import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createPurchaseSchema } from "@/lib/validation";
import { isStripeConfigured, createCheckoutSessionForPurchase } from "@/lib/stripe";
import { track } from "@/lib/analytics";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const athlete = await prisma.athlete.findUnique({ where: { id: params.id } });
  if (!athlete || athlete.coachId !== session.user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const purchases = await prisma.purchase.findMany({
    where: { athleteId: athlete.id },
    include: { offer: true, payments: { orderBy: { createdAt: "desc" } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ purchases });
}

/**
 * OFFER -> PURCHASE step. Online payments never get marked PAID here — only
 * the Stripe webhook (a verified event) does that (§20). Offline payments
 * are the coach recording something that already happened in the real
 * world (cash handed over), which is a legitimately different trust model.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const athlete = await prisma.athlete.findUnique({ where: { id: params.id } });
  if (!athlete || athlete.coachId !== session.user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = createPurchaseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dati non validi" }, { status: 400 });
  }

  const offer = await prisma.offer.findUnique({ where: { id: parsed.data.offerId } });
  if (!offer || offer.coachId !== session.user.id || !offer.active) {
    return NextResponse.json({ error: "Offerta non trovata" }, { status: 404 });
  }

  if (parsed.data.method === "ONLINE" && !isStripeConfigured) {
    return NextResponse.json({ error: "I pagamenti online non sono configurati su questo ambiente." }, { status: 503 });
  }

  const expiresAt = offer.expirationDays ? new Date(Date.now() + offer.expirationDays * 24 * 60 * 60 * 1000) : null;

  const purchase = await prisma.purchase.create({
    data: {
      coachId: session.user.id,
      athleteId: athlete.id,
      offerId: offer.id,
      sessionsPurchased: offer.sessionCount,
      expiresAt,
      priceCents: offer.priceCents,
      currency: offer.currency,
      status: "PENDING",
      payments: {
        create: {
          method: parsed.data.method,
          amountCents: offer.priceCents,
          currency: offer.currency,
          status: "PENDING",
        },
      },
    },
    include: { payments: true },
  });

  track("purchase_created", session.user.id, { athleteId: athlete.id, offerId: offer.id, method: parsed.data.method });

  if (parsed.data.method === "ONLINE") {
    try {
      const { url } = await createCheckoutSessionForPurchase({
        offer,
        purchaseId: purchase.id,
        paymentId: purchase.payments[0].id,
        athleteName: athlete.name,
      });
      track("checkout_session_created", session.user.id, { purchaseId: purchase.id });
      return NextResponse.json({ purchase, checkoutUrl: url });
    } catch (err) {
      console.error("Stripe checkout session creation failed", err);
      // No checkout session means no way for the athlete to ever pay this —
      // leaving it behind would be a phantom "pending" row with a dead end.
      await prisma.$transaction([
        prisma.payment.deleteMany({ where: { purchaseId: purchase.id } }),
        prisma.purchase.delete({ where: { id: purchase.id } }),
      ]);
      return NextResponse.json({ error: "Impossibile avviare il pagamento online. Riprova tra poco." }, { status: 502 });
    }
  }

  // Offline: the coach can immediately confirm the payment was received.
  if (parsed.data.markPaidNow) {
    const [, updatedPurchase] = await prisma.$transaction([
      prisma.payment.update({ where: { id: purchase.payments[0].id }, data: { status: "PAID", paidAt: new Date() } }),
      prisma.purchase.update({ where: { id: purchase.id }, data: { status: "ACTIVE" } }),
    ]);
    return NextResponse.json({ purchase: { ...updatedPurchase, payments: purchase.payments } });
  }

  return NextResponse.json({ purchase });
}
