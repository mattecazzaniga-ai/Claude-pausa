import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { TOTAL_SQUARES } from "@/lib/grid";

export const dynamic = "force-dynamic";

const STATUS_CODE: Record<string, number> = { AVAILABLE: 0, OWNED: 1, LISTED: 2 };

/**
 * Returns the whole wall's state as one byte per square (status code, indexed
 * by square id) so the canvas renderer never has to make 100,000 requests.
 * Prices are derived client-side from grid.ts, not sent over the wire.
 */
export async function GET() {
  const rows = await prisma.$queryRaw<{ id: number; status: string }[]>`
    SELECT id, status::text FROM "Square" ORDER BY id ASC
  `;

  const buffer = new Uint8Array(TOTAL_SQUARES);
  for (const row of rows) {
    buffer[row.id] = STATUS_CODE[row.status] ?? 0;
  }

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Cache-Control": "private, max-age=3, must-revalidate",
    },
  });
}
