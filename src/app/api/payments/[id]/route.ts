import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updatePaymentStatusSchema } from "@/lib/validation";
import { track } from "@/lib/analytics";

/**
 * Manual status changes are only allowed for OFFLINE payments — an ONLINE
 * payment's status is owned exclusively by the verified Stripe webhook
 * (§20: "never mark a payment as successfully paid only because the
 * frontend says so"). This endpoint is the coach recording something that
 * already happened off-platform (cash handed over, a bank transfer seen).
 */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payment = await prisma.payment.findUnique({ where: { id: params.id }, include: { purchase: true } });
  if (!payment || payment.purchase.coachId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (payment.method === "ONLINE") {
    return NextResponse.json({ error: "I pagamenti online si aggiornano solo tramite Stripe." }, { status: 409 });
  }

  const body = await req.json().catch(() => null);
  const parsed = updatePaymentStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dati non validi" }, { status: 400 });
  }

  const updated = await prisma.payment.update({
    where: { id: payment.id },
    data: { status: parsed.data.status, paidAt: parsed.data.status === "PAID" ? new Date() : payment.paidAt },
  });

  // Keep the purchase's own status roughly in sync with its payment.
  if (parsed.data.status === "PAID" && payment.purchase.status === "PENDING") {
    await prisma.purchase.update({ where: { id: payment.purchase.id }, data: { status: "ACTIVE" } });
  } else if (parsed.data.status === "REFUNDED" || parsed.data.status === "CANCELLED") {
    await prisma.purchase.update({ where: { id: payment.purchase.id }, data: { status: "CANCELLED" } });
  }

  track("payment_status_updated", session.user.id, { paymentId: payment.id, status: parsed.data.status });

  return NextResponse.json({ payment: updated });
}
