import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createTeamSchema } from "@/lib/validation";
import { track } from "@/lib/analytics";
import { computeTeamTopPriority } from "@/lib/team-priority";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const teams = await prisma.team.findMany({
    where: { coachId: session.user.id },
    include: {
      sport: { select: { name: true } },
      members: { include: { athlete: { select: { aiPriorities: true } } } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({
    teams: teams.map((t) => ({
      id: t.id,
      name: t.name,
      sportName: t.sport.name,
      memberCount: t.members.length,
      topPriority: computeTeamTopPriority(t.members.map((m) => m.athlete.aiPriorities)),
    })),
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const coach = await prisma.coach.findUnique({ where: { id: session.user.id }, select: { primarySportId: true } });
  if (!coach?.primarySportId) {
    return NextResponse.json({ error: "Seleziona prima il tuo sport principale.", code: "SPORT_REQUIRED" }, { status: 409 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createTeamSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dati non validi" }, { status: 400 });
  }

  const requestedIds = parsed.data.athleteIds ?? [];

  // Only the coach's own athletes for their own sport can be added — prevents
  // cross-coach data leaks and mixing sports inside one team.
  const validAthletes = requestedIds.length
    ? await prisma.athlete.findMany({
        where: { id: { in: requestedIds }, coachId: session.user.id, sportId: coach.primarySportId },
        select: { id: true },
      })
    : [];
  if (requestedIds.length > 0 && validAthletes.length === 0) {
    return NextResponse.json({ error: "Nessuno degli atleti selezionati è valido per questo sport." }, { status: 400 });
  }

  const team = await prisma.team.create({
    data: {
      coachId: session.user.id,
      sportId: coach.primarySportId,
      name: parsed.data.name,
      members: { create: validAthletes.map((a) => ({ athleteId: a.id })) },
    },
  });

  track("team_created", session.user.id, { teamId: team.id, memberCount: validAthletes.length });

  return NextResponse.json({ team });
}
