import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createOfferSchema } from "@/lib/validation";
import { track } from "@/lib/analytics";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const includeInactive = url.searchParams.get("includeInactive") === "true";

  const offers = await prisma.offer.findMany({
    where: { coachId: session.user.id, ...(includeInactive ? {} : { active: true }) },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ offers });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const coach = await prisma.coach.findUnique({ where: { id: session.user.id }, select: { primarySportId: true } });

  const body = await req.json().catch(() => null);
  const parsed = createOfferSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dati non validi" }, { status: 400 });
  }

  const offer = await prisma.offer.create({
    data: { ...parsed.data, coachId: session.user.id, sportId: coach?.primarySportId ?? undefined },
  });

  track("offer_created", session.user.id, { offerId: offer.id, type: offer.type });

  return NextResponse.json({ offer });
}
