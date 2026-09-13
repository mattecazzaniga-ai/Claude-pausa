import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAiConfigured } from "@/lib/ai";
import { Nav } from "@/components/nav";
import { TeamClient } from "./team-client";
import type { TeamData } from "./types";

export default async function TeamPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect(`/login?callbackUrl=/teams/${params.id}`);

  const team = await prisma.team.findUnique({
    where: { id: params.id },
    include: {
      sport: { select: { name: true } },
      members: { include: { athlete: { select: { id: true, name: true, level: true } } } },
      trainingSessions: { orderBy: { createdAt: "desc" }, select: { id: true, objective: true, durationMinutes: true, createdAt: true } },
      goals: { orderBy: [{ status: "asc" }, { createdAt: "desc" }] },
    },
  });

  if (!team || team.coachId !== session.user.id) notFound();

  const allAthletes = await prisma.athlete.findMany({
    where: { coachId: session.user.id, sportId: team.sportId },
    select: { id: true, name: true },
  });
  const memberIds = new Set(team.members.map((m) => m.athlete.id));

  const data: TeamData = {
    id: team.id,
    name: team.name,
    sportName: team.sport.name,
    members: team.members.map((m) => ({ id: m.athlete.id, name: m.athlete.name, level: m.athlete.level })),
    availableAthletes: allAthletes.filter((a) => !memberIds.has(a.id)),
    sessions: team.trainingSessions.map((s) => ({
      id: s.id,
      objective: s.objective,
      durationMinutes: s.durationMinutes,
      createdAt: s.createdAt.toISOString(),
    })),
    goals: team.goals.map((g) => ({
      id: g.id,
      title: g.title,
      description: g.description,
      termLength: g.termLength,
      kind: g.kind,
      baselineValue: g.baselineValue,
      targetValue: g.targetValue,
      currentValue: g.currentValue,
      unit: g.unit,
      deadline: g.deadline?.toISOString() ?? null,
      status: g.status,
    })),
  };

  return (
    <main className="min-h-screen">
      <Nav />
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <Link href="/teams" className="text-sm text-muted hover:text-foreground">
          ← Le tue squadre
        </Link>
      </div>
      <TeamClient initialData={data} aiConfigured={isAiConfigured} />
    </main>
  );
}
