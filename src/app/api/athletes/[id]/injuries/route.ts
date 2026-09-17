import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createInjurySchema } from "@/lib/validation";
import { computeOverallInjuryStatus } from "@/lib/injuries";
import { track } from "@/lib/analytics";

export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const athlete = await prisma.athlete.findUnique({ where: { id: params.id } });
  if (!athlete || athlete.coachId !== session.user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const injuries = await prisma.athleteInjury.findMany({
    where: { athleteId: params.id },
    orderBy: { startDate: "desc" },
    include: { events: { orderBy: { date: "asc" } } },
  });

  return NextResponse.json({ injuries, overallStatus: computeOverallInjuryStatus(injuries) });
}

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const athlete = await prisma.athlete.findUnique({ where: { id: params.id } });
  if (!athlete || athlete.coachId !== session.user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = createInjurySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dati non validi" }, { status: 400 });
  }

  const injury = await prisma.athleteInjury.create({
    data: {
      athleteId: athlete.id,
      coachId: session.user.id,
      type: parsed.data.type,
      bodyRegion: parsed.data.bodyRegion,
      side: parsed.data.side ?? undefined,
      areaDetail: parsed.data.areaDetail || undefined,
      origin: parsed.data.origin ?? undefined,
      startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : undefined,
      description: parsed.data.description || undefined,
      reportedLimitations: parsed.data.reportedLimitations || undefined,
      coachNotes: parsed.data.coachNotes || undefined,
    },
    include: { events: true },
  });

  track("injury_recorded", session.user.id, { athleteId: athlete.id, type: injury.type });

  return NextResponse.json({ injury });
}
