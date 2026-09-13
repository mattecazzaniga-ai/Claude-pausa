import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Nav } from "@/components/nav";
import { SessionClient } from "./session-client";
import type { TrainingSessionData } from "./types";

export default async function SessionPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect(`/login?callbackUrl=/sessions/${params.id}`);

  const trainingSession = await prisma.trainingSession.findUnique({
    where: { id: params.id },
    include: {
      athlete: { select: { id: true, name: true } },
      blocks: {
        orderBy: { order: "asc" },
        include: { exercise: { include: { skills: { include: { skill: true } } } } },
      },
    },
  });

  if (!trainingSession || trainingSession.coachId !== session.user.id) notFound();

  const data: TrainingSessionData = {
    id: trainingSession.id,
    objective: trainingSession.objective,
    durationMinutes: trainingSession.durationMinutes,
    createdAt: trainingSession.createdAt.toISOString(),
    athlete: trainingSession.athlete,
    blocks: trainingSession.blocks.map((b) => ({
      id: b.id,
      order: b.order,
      type: b.type,
      durationMinutes: b.durationMinutes,
      rationale: b.rationale,
      exercise: b.exercise
        ? {
            id: b.exercise.id,
            name: b.exercise.name,
            description: b.exercise.description,
            coachingPoints: b.exercise.coachingPoints,
            commonMistakes: b.exercise.commonMistakes,
            equipment: b.exercise.equipment,
            source: b.exercise.source,
            skills: b.exercise.skills.map((s) => s.skill.name),
          }
        : null,
    })),
  };

  return (
    <main className="min-h-screen">
      <Nav />
      <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
        <Link href={`/athletes/${trainingSession.athlete.id}`} className="text-sm text-muted hover:text-foreground">
          ← {trainingSession.athlete.name}
        </Link>
      </div>
      <SessionClient initialData={data} />
    </main>
  );
}
