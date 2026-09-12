import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isValidId } from "@/lib/grid";
import { createListingSchema } from "@/lib/validation";
import { track } from "@/lib/analytics";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = Number(params.id);
  if (!isValidId(id)) return NextResponse.json({ error: "Invalid square id" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const parsed = createListingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid price" }, { status: 400 });
  }

  const result = await prisma.$transaction(async (tx) => {
    const square = await tx.square.findUnique({ where: { id } });
    if (!square) return { error: "Square not found", status: 404 } as const;
    if (square.ownerId !== session.user.id) return { error: "You do not own this square", status: 403 } as const;
    if (square.status !== "OWNED") return { error: "This square cannot be listed right now", status: 409 } as const;

    const listing = await tx.listing.create({
      data: { squareId: id, sellerId: session.user.id, price: parsed.data.price, status: "ACTIVE" },
    });
    await tx.square.update({ where: { id }, data: { status: "LISTED" } });

    return { listing } as const;
  });

  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });

  track("listing_created", session.user.id, { squareId: id, price: parsed.data.price });
  track("resale_started", session.user.id, { squareId: id, price: parsed.data.price });

  return NextResponse.json({ listing: result.listing });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = Number(params.id);
  if (!isValidId(id)) return NextResponse.json({ error: "Invalid square id" }, { status: 400 });

  const result = await prisma.$transaction(async (tx) => {
    const square = await tx.square.findUnique({ where: { id } });
    if (!square) return { error: "Square not found", status: 404 } as const;
    if (square.ownerId !== session.user.id) return { error: "You do not own this square", status: 403 } as const;

    const listing = await tx.listing.findFirst({ where: { squareId: id, status: "ACTIVE" } });
    if (!listing) return { error: "No active listing for this square", status: 404 } as const;

    await tx.listing.update({ where: { id: listing.id }, data: { status: "CANCELLED" } });
    await tx.square.update({ where: { id }, data: { status: "OWNED" } });

    return { ok: true } as const;
  });

  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });

  return NextResponse.json({ ok: true });
}
