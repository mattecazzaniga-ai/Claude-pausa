import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createCompetitionSchema } from "@/lib/validation";
import { track } from "@/lib/analytics";

const DEFAULT_DURATION_MS = 2 * 60 * 60 * 1000;

export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const athlete = await prisma.athlete.findUnique({ where: { id: params.id } });
  if (!athlete || athlete.coachId !== session.user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const competitions = await prisma.competition.findMany({
    where: { athleteId: params.id },
    orderBy: { scheduledAt: "desc" },
  });

  return NextResponse.json({ competitions });
}

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const athlete = await prisma.athlete.findUnique({ where: { id: params.id } });
  if (!athlete || athlete.coachId !== session.user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = createCompetitionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dati non validi" }, { status: 400 });
  }

  const scheduledAt = new Date(parsed.data.scheduledAt);

  const competition = await prisma.competition.create({
    data: {
      coachId: session.user.id,
      athleteId: athlete.id,
      sportId: athlete.sportId,
      name: parsed.data.name,
      type: parsed.data.type,
      scheduledAt,
      location: parsed.data.location || undefined,
      opponent: parsed.data.opponent || undefined,
      importance: parsed.data.importance || undefined,
      preNotes: parsed.data.preNotes || undefined,
    },
  });

  // Auto-create the matching calendar event — the coach shouldn't have to
  // enter the same date twice (master prompt §40).
  await prisma.calendarEvent.create({
    data: {
      coachId: session.user.id,
      athleteId: athlete.id,
      competitionId: competition.id,
      type: "COMPETITION",
      title: competition.name,
      startAt: scheduledAt,
      endAt: new Date(scheduledAt.getTime() + DEFAULT_DURATION_MS),
      location: competition.location,
    },
  });

  track("competition_created", session.user.id, { athleteId: athlete.id, competitionId: competition.id });

  return NextResponse.json({ competition });
}
