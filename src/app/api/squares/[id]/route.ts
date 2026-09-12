import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isValidId, priceForId } from "@/lib/grid";
import { customizeSquareSchema } from "@/lib/validation";
import { track } from "@/lib/analytics";

function parseId(raw: string): number | null {
  const id = Number(raw);
  return isValidId(id) ? id : null;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const id = parseId(params.id);
  if (id === null) return NextResponse.json({ error: "Invalid square id" }, { status: 400 });

  const square = await prisma.square.findUnique({
    where: { id },
    include: {
      owner: { select: { username: true, avatarUrl: true } },
      listings: { where: { status: "ACTIVE" }, select: { id: true, price: true, createdAt: true } },
    },
  });

  // Squares are pre-seeded for the whole wall, but guard anyway in case a
  // requested id somehow isn't seeded yet.
  if (!square) {
    return NextResponse.json({
      id,
      price: priceForId(id),
      status: "AVAILABLE",
    });
  }

  track("square_view", null, { squareId: id });

  return NextResponse.json({
    id: square.id,
    coordinateX: square.coordinateX,
    coordinateY: square.coordinateY,
    price: square.price,
    status: square.status,
    title: square.title,
    description: square.description,
    imageUrl: square.imageUrl,
    externalUrl: square.externalUrl,
    backgroundColor: square.backgroundColor,
    purchasedAt: square.purchasedAt,
    owner: square.owner,
    activeListing: square.listings[0] ?? null,
  });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = parseId(params.id);
  if (id === null) return NextResponse.json({ error: "Invalid square id" }, { status: 400 });

  const square = await prisma.square.findUnique({ where: { id } });
  if (!square) return NextResponse.json({ error: "Square not found" }, { status: 404 });
  if (square.ownerId !== session.user.id) {
    return NextResponse.json({ error: "You do not own this square" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = customizeSquareSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const { title, description, imageUrl, externalUrl, backgroundColor } = parsed.data;

  const updated = await prisma.square.update({
    where: { id },
    data: {
      title: title ?? undefined,
      description: description ?? undefined,
      imageUrl: imageUrl === "" ? null : imageUrl ?? undefined,
      externalUrl: externalUrl === "" ? null : externalUrl ?? undefined,
      backgroundColor: backgroundColor ?? undefined,
    },
  });

  track("square_customized", session.user.id, { squareId: id });

  return NextResponse.json({ square: updated });
}
