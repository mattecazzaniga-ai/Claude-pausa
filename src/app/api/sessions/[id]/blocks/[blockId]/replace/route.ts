import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAiConfigured } from "@/lib/ai";
import { generateReplacementExercise, type LibraryExercise } from "@/lib/ai-session";
import { getSportProfile, formatSportProfileForPrompt } from "@/lib/sport";
import { rateLimit } from "@/lib/rate-limit";
import { track } from "@/lib/analytics";
import { recordCoachFeedbackSignal } from "@/lib/intelligence/coach-brain";
import { captureError } from "@/lib/monitoring";
import type { $Enums } from "@prisma/client";

const BLOCK_TYPE_TO_EXERCISE_CATEGORY: Record<string, $Enums.ExerciseCategory> = {
  WARMUP: "WARMUP",
  TECHNICAL: "TECHNICAL",
  TACTICAL: "TACTICAL",
  PHYSICAL: "PHYSICAL",
  GAME: "COMPETITIVE",
  COOLDOWN: "COOLDOWN",
};

export async function POST(_req: Request, { params }: { params: { id: string; blockId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isAiConfigured) return NextResponse.json({ error: "L'AI non è configurata su questo ambiente." }, { status: 503 });

  if (!rateLimit(`block-replace:${session.user.id}`, 30, 60 * 1000)) {
    return NextResponse.json({ error: "Troppe richieste, rallenta un attimo." }, { status: 429 });
  }

  const trainingSession = await prisma.trainingSession.findUnique({ where: { id: params.id } });
  if (!trainingSession || trainingSession.coachId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const block = await prisma.sessionBlock.findUnique({ where: { id: params.blockId }, include: { exercise: true } });
  if (!block || block.trainingSessionId !== params.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const libraryRows = await prisma.exercise.findMany({
    where: { coachId: session.user.id, sportId: trainingSession.sportId ?? undefined },
    include: { skills: { include: { skill: true } } },
  });
  const libraryExercises: LibraryExercise[] = libraryRows.map((e) => ({
    id: e.id,
    name: e.name,
    category: e.category,
    format: e.format,
    difficulty: e.difficulty,
    durationMinutes: e.durationMinutes,
    equipment: e.equipment,
    skillNames: e.skills.map((s) => s.skill.name),
  }));

  let sportContext: string | undefined;
  if (trainingSession.sportId) {
    const sport = await prisma.sport.findUnique({ where: { id: trainingSession.sportId }, select: { name: true } });
    if (sport) {
      const sportProfile = await getSportProfile(trainingSession.sportId);
      sportContext = formatSportProfileForPrompt(sport.name, sportProfile);
    }
  }

  let replacement;
  try {
    replacement = await generateReplacementExercise({
      blockType: block.type,
      currentExerciseName: block.exercise?.name ?? "esercizio corrente",
      libraryExercises,
      excludeExerciseId: block.exerciseId ?? "",
      sportContext,
    });
  } catch (err) {
    captureError("AI block replacement failed", err);
    return NextResponse.json({ error: "La generazione AI non è riuscita. Riprova tra poco." }, { status: 502 });
  }

  let exerciseId: string | null = replacement.chosenExerciseId || null;
  if (!exerciseId && replacement.newExerciseName) {
    const created = await prisma.exercise.create({
      data: {
        coachId: session.user.id,
        sportId: trainingSession.sportId ?? libraryRows[0]?.sportId ?? "",
        name: replacement.newExerciseName,
        description: replacement.newExerciseDescription || undefined,
        coachingPoints: replacement.newExerciseCoachingPoints || undefined,
        category: BLOCK_TYPE_TO_EXERCISE_CATEGORY[block.type] ?? "TECHNICAL",
        durationMinutes: block.durationMinutes,
        source: "AI_GENERATED",
      },
    });
    exerciseId = created.id;
  }

  const updated = await prisma.sessionBlock.update({
    where: { id: block.id },
    data: { exerciseId, rationale: replacement.rationale },
    include: { exercise: { include: { skills: { include: { skill: true } } } } },
  });

  track("session_block_replaced", session.user.id, { sessionId: params.id, blockId: block.id });

  await recordCoachFeedbackSignal(
    session.user.id,
    "EXERCISE_REPLACED",
    `Ha sostituito l'esercizio suggerito dall'AI per un blocco di tipo ${block.type} ("${block.exercise?.name ?? "esercizio corrente"}").`,
    { blockType: block.type, previousExerciseId: block.exerciseId ?? null },
  );

  return NextResponse.json({ block: updated });
}
