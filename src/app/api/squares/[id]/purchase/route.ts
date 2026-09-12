import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isValidId } from "@/lib/grid";
import { createCheckoutSession } from "@/lib/payments";
import { rateLimit } from "@/lib/rate-limit";
import { track } from "@/lib/analytics";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "You must be logged in to buy a square." }, { status: 401 });

  if (!rateLimit(`purchase:${session.user.id}`, 10, 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests. Slow down." }, { status: 429 });
  }

  const id = Number(params.id);
  if (!isValidId(id)) return NextResponse.json({ error: "Invalid square id" }, { status: 400 });

  const square = await prisma.square.findUnique({ where: { id } });
  if (!square) return NextResponse.json({ error: "Square not found" }, { status: 404 });
  if (square.status !== "AVAILABLE") {
    return NextResponse.json({ error: "This square is no longer available." }, { status: 409 });
  }

  // Price is always read from the database, never from the client.
  const transaction = await prisma.transaction.create({
    data: {
      squareId: id,
      buyerId: session.user.id,
      sellerId: null,
      amount: square.price,
      platformFee: 0,
      type: "PRIMARY",
      status: "PENDING",
      chapterId: square.chapterId,
    },
  });

  const checkout = await createCheckoutSession({
    transactionId: transaction.id,
    squareId: id,
    amountEUR: square.price,
    description: `Internet Wall — square #${id}`,
    successPath: `/square/${id}?purchased=1`,
    cancelPath: `/square/${id}`,
  });

  await prisma.transaction.update({
    where: { id: transaction.id },
    data: { stripeSessionId: checkout.sessionId },
  });

  track("square_purchase_started", session.user.id, { squareId: id, amount: square.price });

  return NextResponse.json({ checkoutUrl: checkout.url });
}
