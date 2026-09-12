import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const chapters = await prisma.chapter.findMany({ orderBy: { number: "desc" } });
  return NextResponse.json({ chapters });
}

/** Ends the current active chapter and starts a new 90-day chapter. */
export async function POST() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const active = await prisma.chapter.findFirst({ where: { status: "ACTIVE" }, orderBy: { number: "desc" } });

  const result = await prisma.$transaction(async (tx) => {
    if (active) {
      await tx.chapter.update({ where: { id: active.id }, data: { status: "ENDED" } });
    }
    const nextNumber = (active?.number ?? 0) + 1;
    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + 90 * 24 * 60 * 60 * 1000);
    return tx.chapter.create({
      data: { number: nextNumber, startDate, endDate, status: "ACTIVE" },
    });
  });

  return NextResponse.json({ chapter: result });
}
