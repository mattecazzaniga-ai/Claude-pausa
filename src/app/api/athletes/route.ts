import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAthleteSchema } from "@/lib/validation";
import { track } from "@/lib/analytics";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const athletes = await prisma.athlete.findMany({
    where: { coachId: session.user.id },
    include: {
      sport: { select: { name: true } },
      sessionNotes: { select: { sessionDate: true }, orderBy: { sessionDate: "desc" }, take: 1 },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({
    athletes: athletes.map((a) => ({
      id: a.id,
      name: a.name,
      level: a.level,
      sportName: a.sport.name,
      lastSessionDate: a.sessionNotes[0]?.sessionDate ?? null,
      priorityCount: Array.isArray(a.aiPriorities) ? a.aiPriorities.length : 0,
    })),
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = createAthleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dati non validi" }, { status: 400 });
  }

  // MVP ships with a single sport (beach tennis); once more sports exist this
  // becomes a field on the form instead of a fixed lookup.
  const sport = await prisma.sport.findUnique({ where: { slug: "beach-tennis" } });
  if (!sport) return NextResponse.json({ error: "Sport non configurato" }, { status: 500 });

  const athlete = await prisma.athlete.create({
    data: {
      coachId: session.user.id,
      sportId: sport.id,
      name: parsed.data.name,
      birthYear: parsed.data.birthYear ?? undefined,
      level: parsed.data.level ?? undefined,
      objectives: parsed.data.objectives ?? undefined,
    },
  });

  track("athlete_created", session.user.id, { athleteId: athlete.id });

  return NextResponse.json({ athlete });
}
