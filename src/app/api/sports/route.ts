import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Must stay dynamic: a static build would freeze whatever sports existed (or
// didn't) at build time, before the seed script has necessarily run.
export const dynamic = "force-dynamic";

export async function GET() {
  const sports = await prisma.sport.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, slug: true } });
  return NextResponse.json({ sports });
}
