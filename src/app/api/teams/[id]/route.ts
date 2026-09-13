import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
