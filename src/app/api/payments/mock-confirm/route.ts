import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isStripeConfigured } from "@/lib/payments";
import { finalizePurchase } from "@/lib/purchase";

/**
 * Dev/test-only confirmation endpoint that stands in for the Stripe webhook
 * when no Stripe credentials are configured. It calls the exact same
 * `finalizePurchase` the real webhook calls — it never contains its own
 * "mark as owned" logic — and is hard-gated off the moment Stripe is
 * configured, so it can never fire in a production deployment with real
 * payments wired up.
 */
export async function POST(req: Request) {
  if (isStripeConfigured) {
    return NextResponse.json({ error: "Mock payments are disabled: Stripe is configured." }, { status: 403 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const transactionId = body?.transactionId as string | undefined;
  const outcome = body?.outcome as "success" | "fail" | undefined;
  if (!transactionId || !outcome) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const transaction = await prisma.transaction.findUnique({ where: { id: transactionId } });
  if (!transaction) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  if (transaction.buyerId !== session.user.id) {
    return NextResponse.json({ error: "Not your transaction" }, { status: 403 });
  }

  if (outcome === "fail") {
    await prisma.transaction.update({ where: { id: transactionId }, data: { status: "FAILED" } });
    return NextResponse.json({ ok: true, status: "FAILED" });
  }

  const result = await finalizePurchase(transactionId, { stripePaymentIntentId: `mock_pi_${transactionId}` });
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 409 });
  }

  return NextResponse.json({ ok: true, status: "COMPLETED" });
}
