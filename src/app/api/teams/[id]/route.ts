import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteTeamCascade } from "@/lib/cascade-delete";
import { forgetTeamMemory } from "@/lib/intelligence/coach-brain";
import { track } from "@/lib/analytics";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const team = await prisma.team.findUnique({
    where: { id: params.id },
    include: {
      sport: { select: { id: true, name: true } },
      members: { include: { athlete: { select: { id: true, name: true, level: true } } } },
      trainingSessions: { orderBy: { createdAt: "desc" }, select: { id: true, objective: true, durationMinutes: true, createdAt: true } },
    },
  });

  if (!team || team.coachId !== session.user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    team: {
      id: team.id,
      name: team.name,
      sportId: team.sportId,
      sportName: team.sport.name,
      members: team.members.map((m) => ({ id: m.athlete.id, name: m.athlete.name, level: m.athlete.level })),
      sessions: team.trainingSessions,
    },
  });
}

/** Removes the team and every record that exists only because of it (roster, sessions, evaluations, objectives, competitions, calendar events). */
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const team = await prisma.team.findUnique({ where: { id: params.id } });
  if (!team || team.coachId !== session.user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const forgetAiMemory = body?.forgetAiMemory === true;

  // Must run before the cascade delete: once the team is gone, the
  // now-orphaned signals get their teamId nulled out by the DB and can no
  // longer be found by it.
  if (forgetAiMemory) {
    await forgetTeamMemory(session.user.id, team.id);
  }

  await prisma.$transaction((tx) => deleteTeamCascade(tx, team.id));

  track("team_deleted", session.user.id, { teamId: team.id, forgetAiMemory });

  return NextResponse.json({ ok: true });
}
