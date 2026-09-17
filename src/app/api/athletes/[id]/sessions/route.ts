import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateSessionSchema } from "@/lib/validation";
import { isAiConfigured } from "@/lib/ai";
import { generateSessionPlan, type LibraryExercise } from "@/lib/ai-session";
import { getSportProfile, formatSportProfileForPrompt } from "@/lib/sport";
import { computeAdaptationSignal, formatAdaptationDirective, formatAdaptationNote } from "@/lib/adaptive-training";
import { getActiveInjuries, formatInjuriesForPrompt, formatInjuryAdaptationNote } from "@/lib/injuries";
import { getMethodologyPromptText, getCurrentMethodologyVersion } from "@/lib/methodology";
import { persistGeneratedSession } from "@/lib/create-training-session";
import { rateLimit } from "@/lib/rate-limit";
import { track } from "@/lib/analytics";
import { captureError } from "@/lib/monitoring";

export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
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

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
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

  const [latestCheckin, recentSessions, activeInjuries, methodologyText, methodologyVersion] = await Promise.all([
    prisma.athleteCheckin.findFirst({ where: { athleteId: athlete.id }, orderBy: { date: "desc" } }),
    prisma.trainingSession.findMany({
      where: { athleteId: athlete.id },
      orderBy: { createdAt: "desc" },
      take: 2,
      select: { createdAt: true, feedbackRating: true },
    }),
    getActiveInjuries(athlete.id),
    getMethodologyPromptText(session.user.id),
    getCurrentMethodologyVersion(session.user.id),
  ]);
  const adaptation = computeAdaptationSignal({ latestCheckin, recentSessions });
  const injuryDirective = formatInjuriesForPrompt(activeInjuries);

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
      adaptationDirective: adaptation ? formatAdaptationDirective(adaptation) : undefined,
      injuryConstraints: injuryDirective ?? undefined,
      methodologyText: methodologyText ?? undefined,
    });
  } catch (err) {
    captureError("AI session generation failed", err);
    return NextResponse.json({ error: "La generazione AI non è riuscita. Riprova tra poco." }, { status: 502 });
  }

  const adaptationNoteParts = [
    adaptation ? formatAdaptationNote(adaptation) : null,
    activeInjuries.length ? formatInjuryAdaptationNote(activeInjuries) : null,
  ].filter((n): n is string => Boolean(n));

  const sessionId = await persistGeneratedSession({
    coachId: session.user.id,
    athleteId: athlete.id,
    sportId: athlete.sportId,
    durationMinutes: parsed.data.durationMinutes,
    plan,
    adaptationNote: adaptationNoteParts.length ? adaptationNoteParts.join(" ") : undefined,
    methodologyVersion,
  });

  track("training_session_generated", session.user.id, { athleteId: athlete.id, sessionId });

  return NextResponse.json({ sessionId });
}
