import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createCheckoutSession } from "@/lib/payments";
import { rateLimit } from "@/lib/rate-limit";
import { track } from "@/lib/analytics";

const PLATFORM_FEE_RATE = 0.05;

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "You must be logged in to buy a square." }, { status: 401 });

  if (!rateLimit(`resale-purchase:${session.user.id}`, 10, 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests. Slow down." }, { status: 429 });
  }

  const listing = await prisma.listing.findUnique({
    where: { id: params.id },
    include: { square: true },
  });
  if (!listing) return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  if (listing.status !== "ACTIVE") return NextResponse.json({ error: "This listing is no longer active." }, { status: 409 });
  if (listing.sellerId === session.user.id) {
    return NextResponse.json({ error: "You cannot buy your own listing." }, { status: 400 });
  }

  // Fee is always computed server-side from the listing's stored price.
  const platformFee = Math.round(listing.price * PLATFORM_FEE_RATE * 100) / 100;

  const transaction = await prisma.transaction.create({
    data: {
      squareId: listing.squareId,
      buyerId: session.user.id,
      sellerId: listing.sellerId,
      amount: listing.price,
      platformFee,
      type: "SECONDARY",
      status: "PENDING",
      chapterId: listing.square.chapterId,
    },
  });

  const checkout = await createCheckoutSession({
    transactionId: transaction.id,
    squareId: listing.squareId,
    amountEUR: listing.price,
    description: `Internet Wall — square #${listing.squareId} (resale)`,
    successPath: `/square/${listing.squareId}?purchased=1`,
    cancelPath: `/square/${listing.squareId}`,
  });

  await prisma.transaction.update({ where: { id: transaction.id }, data: { stripeSessionId: checkout.sessionId } });

  track("square_purchase_started", session.user.id, { squareId: listing.squareId, amount: listing.price, resale: true });

  return NextResponse.json({ checkoutUrl: checkout.url });
}
