import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createTrainingLoadEntrySchema } from "@/lib/validation";
import { computeTrainingLoad } from "@/lib/training-load";
import { track } from "@/lib/analytics";

const RECENT_ENTRIES_LIMIT = 60;

export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const athlete = await prisma.athlete.findUnique({
    where: { id: params.id },
    include: { sport: { select: { name: true, disciplines: true } } },
  });
  if (!athlete || athlete.coachId !== session.user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const entries = await prisma.trainingLoadEntry.findMany({
    where: { athleteId: params.id },
    orderBy: { date: "desc" },
    take: RECENT_ENTRIES_LIMIT,
  });

  // Disciplines this athlete's sport actually trains separately (e.g. a
  // Triathlon: Nuoto/Ciclismo/Corsa — see Sport.disciplines). Empty for
  // every single-discipline sport, where the discipline is just the sport
  // itself rather than something the coach picks per entry.
  return NextResponse.json({ entries, sportName: athlete.sport.name, disciplines: athlete.sport.disciplines });
}

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const athlete = await prisma.athlete.findUnique({ where: { id: params.id } });
  if (!athlete || athlete.coachId !== session.user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = createTrainingLoadEntrySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dati non validi" }, { status: 400 });
  }

  const zone = parsed.data.zone ?? "MODERATE";
  const load = computeTrainingLoad({
    durationMinutes: parsed.data.durationMinutes,
    rpe: parsed.data.rpe,
    discipline: parsed.data.discipline,
    zone,
  });

  const entry = await prisma.trainingLoadEntry.create({
    data: {
      athleteId: athlete.id,
      coachId: session.user.id,
      discipline: parsed.data.discipline,
      durationMinutes: parsed.data.durationMinutes,
      rpe: parsed.data.rpe,
      zone,
      load,
      date: parsed.data.date ? new Date(parsed.data.date) : undefined,
      notes: parsed.data.notes || undefined,
    },
  });

  track("training_load_recorded", session.user.id, { athleteId: athlete.id, discipline: entry.discipline, zone: entry.zone, load: entry.load });

  return NextResponse.json({ entry });
}
