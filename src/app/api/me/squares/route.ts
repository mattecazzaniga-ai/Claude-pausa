import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ squareIds: [] });

  const squares = await prisma.square.findMany({
    where: { ownerId: session.user.id },
    select: { id: true },
  });

  return NextResponse.json({ squareIds: squares.map((s) => s.id) });
}
