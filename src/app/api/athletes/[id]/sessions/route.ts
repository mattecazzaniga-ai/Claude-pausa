import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateSessionSchema } from "@/lib/validation";
import { isAiConfigured } from "@/lib/ai";
import { generateSessionPlan, type LibraryExercise } from "@/lib/ai-session";
import { getSportProfile, formatSportProfileForPrompt } from "@/lib/sport";
import { rateLimit } from "@/lib/rate-limit";
import { track } from "@/lib/analytics";
import type { $Enums } from "@prisma/client";

// SessionBlockType and ExerciseCategory are deliberately separate enums (a
// "GAME" block is a valid session phase but not an exercise category) — map
// between them rather than casting, so an invalid value never reaches Prisma.
const BLOCK_TYPE_TO_EXERCISE_CATEGORY: Record<string, $Enums.ExerciseCategory> = {
  WARMUP: "WARMUP",
  TECHNICAL: "TECHNICAL",
  TACTICAL: "TACTICAL",
  PHYSICAL: "PHYSICAL",
  GAME: "COMPETITIVE",
  COOLDOWN: "COOLDOWN",
};

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const athlete = await prisma.athlete.findUnique({ where: { id: params.id } });
  if (!athlete || athlete.coachId !== session.user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const sessions = await prisma.trainingSession.findMany({
    where: { athleteId: params.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, objective: true, durationMinutes: true, createdAt: true },
  });

  return NextResponse.json({ sessions });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isAiConfigured) {
    return NextResponse.json({ error: "L'AI non è configurata su questo ambiente." }, { status: 503 });
  }

  if (!rateLimit(`session-gen:${session.user.id}`, 15, 60 * 1000)) {
    return NextResponse.json({ error: "Troppe richieste, rallenta un attimo." }, { status: 429 });
  }

  const athlete = await prisma.athlete.findUnique({ where: { id: params.id }, include: { sport: true } });
  if (!athlete || athlete.coachId !== session.user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = generateSessionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dati non validi" }, { status: 400 });
  }

  const libraryRows = await prisma.exercise.findMany({
    where: { coachId: session.user.id, sportId: athlete.sportId },
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

  const sportProfile = await getSportProfile(athlete.sportId);
  const sportContext = formatSportProfileForPrompt(athlete.sport.name, sportProfile);

  let plan;
  try {
    plan = await generateSessionPlan({
      athleteName: athlete.name,
      objectives: athlete.objectives,
      aiSummary: athlete.aiSummary,
      aiPriorities: (athlete.aiPriorities as { skill: string; reason: string }[] | null) ?? [],
      durationMinutes: parsed.data.durationMinutes,
      sessionObjective: parsed.data.objective,
      equipmentAvailable: parsed.data.equipment,
      intensity: parsed.data.intensity,
      libraryExercises,
      sportContext,
    });
  } catch (err) {
    console.error("AI session generation failed", err);
    return NextResponse.json({ error: "La generazione AI non è riuscita. Riprova tra poco." }, { status: 502 });
  }

  const trainingSession = await prisma.trainingSession.create({
    data: {
      coachId: session.user.id,
      athleteId: athlete.id,
      sportId: athlete.sportId,
      objective: plan.objective,
      durationMinutes: parsed.data.durationMinutes,
    },
  });

  for (let i = 0; i < plan.blocks.length; i++) {
    const block = plan.blocks[i];
    let exerciseId: string | null = block.chosenExerciseId || null;

    // No library match — the AI proposed something new. Save it as a real
    // exercise (marked AI_GENERATED, never mislabeled as coach-authored) so
    // it also becomes part of the coach's library going forward.
    if (!exerciseId && block.newExerciseName) {
      const created = await prisma.exercise.create({
        data: {
          coachId: session.user.id,
          sportId: athlete.sportId,
          name: block.newExerciseName,
          description: block.newExerciseDescription || undefined,
          coachingPoints: block.newExerciseCoachingPoints || undefined,
          category: BLOCK_TYPE_TO_EXERCISE_CATEGORY[block.type] ?? "TECHNICAL",
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

  track("training_session_generated", session.user.id, { athleteId: athlete.id, sessionId: trainingSession.id });

  return NextResponse.json({ sessionId: trainingSession.id });
}
