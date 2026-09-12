import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Sparse metadata for every non-available square (custom background color).
 * Scales with squares actually sold, not with the full 100,000 — kept separate
 * from /api/wall/state so the hot path (status per square) stays a tiny fixed
 * byte buffer.
 */
export async function GET() {
  const squares = await prisma.square.findMany({
    where: { status: { in: ["OWNED", "LISTED"] } },
    select: { id: true, status: true, backgroundColor: true },
  });

  return NextResponse.json({
    squares: squares.map((s) => ({ id: s.id, status: s.status, color: s.backgroundColor })),
  });
}
