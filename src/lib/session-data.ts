import { prisma } from "@/lib/prisma";
import type { TrainingSessionData } from "@/app/sessions/[id]/types";

/** Shared fetch+shape for a TrainingSession, used by both the read-only session view and Training Mode. */
export async function getTrainingSessionData(id: string, coachId: string): Promise<TrainingSessionData | null> {
  const trainingSession = await prisma.trainingSession.findUnique({
    where: { id },
    include: {
      athlete: { select: { id: true, name: true } },
      team: { select: { id: true, name: true } },
      blocks: {
        orderBy: { order: "asc" },
        include: { exercise: { include: { skills: { include: { skill: true } } } } },
      },
    },
  });

  if (!trainingSession || trainingSession.coachId !== coachId) return null;

  return {
    id: trainingSession.id,
    objective: trainingSession.objective,
    durationMinutes: trainingSession.durationMinutes,
    createdAt: trainingSession.createdAt.toISOString(),
    athlete: trainingSession.athlete,
    team: trainingSession.team,
    feedbackRating: trainingSession.feedbackRating,
    feedbackNote: trainingSession.feedbackNote,
    adaptationNote: trainingSession.adaptationNote,
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
}
