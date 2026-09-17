import { prisma } from "@/lib/prisma";
import type { GeneratedSessionPlan } from "@/lib/ai-session";
import type { $Enums } from "@prisma/client";

const BLOCK_TYPE_TO_EXERCISE_CATEGORY: Record<string, $Enums.ExerciseCategory> = {
  WARMUP: "WARMUP",
  TECHNICAL: "TECHNICAL",
  TACTICAL: "TACTICAL",
  PHYSICAL: "PHYSICAL",
  GAME: "COMPETITIVE",
  COOLDOWN: "COOLDOWN",
};

/**
 * Persists a generated session plan (TrainingSession + its SessionBlocks),
 * creating a real Exercise row for every AI-proposed exercise that had no
 * library match (marked AI_GENERATED, never mislabeled as coach-authored) —
 * the exact same behavior whether the caller is an individual-athlete
 * session, a team session, or a Weekly Training Plan slot being filled in.
 * Factored out here so those three call sites can never drift apart on it.
 */
export async function persistGeneratedSession(params: {
  coachId: string;
  athleteId?: string;
  teamId?: string;
  sportId: string;
  durationMinutes: number;
  plan: GeneratedSessionPlan;
  exerciseFormat?: $Enums.ExerciseFormat;
  adaptationNote?: string | null;
  methodologyVersion?: number | null;
}): Promise<string> {
  const trainingSession = await prisma.trainingSession.create({
    data: {
      coachId: params.coachId,
      athleteId: params.athleteId,
      teamId: params.teamId,
      sportId: params.sportId,
      objective: params.plan.objective,
      durationMinutes: params.durationMinutes,
      adaptationNote: params.adaptationNote || undefined,
      methodologyVersion: params.methodologyVersion ?? undefined,
    },
  });

  for (let i = 0; i < params.plan.blocks.length; i++) {
    const block = params.plan.blocks[i];
    let exerciseId: string | null = block.chosenExerciseId || null;

    if (!exerciseId && block.newExerciseName) {
      const created = await prisma.exercise.create({
        data: {
          coachId: params.coachId,
          sportId: params.sportId,
          name: block.newExerciseName,
          description: block.newExerciseDescription || undefined,
          coachingPoints: block.newExerciseCoachingPoints || undefined,
          category: BLOCK_TYPE_TO_EXERCISE_CATEGORY[block.type] ?? "TECHNICAL",
          format: params.exerciseFormat,
          durationMinutes: block.durationMinutes,
          source: "AI_GENERATED",
        },
      });
      exerciseId = created.id;
    }

    await prisma.sessionBlock.create({
      data: {
        trainingSessionId: trainingSession.id,
        order: i,
        type: block.type,
        durationMinutes: block.durationMinutes,
        exerciseId,
        rationale: block.rationale,
      },
    });
  }

  return trainingSession.id;
}
