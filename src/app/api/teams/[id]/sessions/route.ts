import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateTeamSessionSchema } from "@/lib/validation";
import { isAiConfigured } from "@/lib/ai";
import { generateTeamSessionPlan, type LibraryExercise } from "@/lib/ai-session";
import { getSportProfile, formatSportProfileForPrompt } from "@/lib/sport";
import { computeTeamAdaptationSignal, formatAdaptationDirective, formatAdaptationNote } from "@/lib/adaptive-training";
import { getMethodologyPromptText, getCurrentMethodologyVersion } from "@/lib/methodology";
import { persistGeneratedSession } from "@/lib/create-training-session";
import { rateLimit } from "@/lib/rate-limit";
import { track } from "@/lib/analytics";
import { captureError } from "@/lib/monitoring";

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isAiConfigured) {
    return NextResponse.json({ error: "L'AI non è configurata su questo ambiente." }, { status: 503 });
  }

  if (!rateLimit(`team-session-gen:${session.user.id}`, 15, 60 * 1000)) {
    return NextResponse.json({ error: "Troppe richieste, rallenta un attimo." }, { status: 429 });
  }

  const team = await prisma.team.findUnique({
    where: { id: params.id },
    include: { sport: true, members: { include: { athlete: true } } },
  });
  if (!team || team.coachId !== session.user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (team.members.length === 0) {
    return NextResponse.json({ error: "Aggiungi almeno un atleta alla squadra prima di generare una sessione." }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = generateTeamSessionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dati non validi" }, { status: 400 });
  }

  const libraryRows = await prisma.exercise.findMany({
    where: { coachId: session.user.id, sportId: team.sportId },
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

  const sportProfile = await getSportProfile(team.sportId);
  const sportContext = formatSportProfileForPrompt(team.sport.name, sportProfile);

  const memberAthleteIds = team.members.map((m) => m.athleteId);
  const recentCheckins = await prisma.athleteCheckin.findMany({
    where: { athleteId: { in: memberAthleteIds } },
    orderBy: { date: "desc" },
  });
  const latestCheckinByAthlete = new Map<string, (typeof recentCheckins)[number]>();
  for (const c of recentCheckins) {
    if (!latestCheckinByAthlete.has(c.athleteId)) latestCheckinByAthlete.set(c.athleteId, c);
  }
  const adaptation = computeTeamAdaptationSignal(memberAthleteIds.map((id) => latestCheckinByAthlete.get(id) ?? null));
  const [methodologyText, methodologyVersion] = await Promise.all([
    getMethodologyPromptText(session.user.id),
    getCurrentMethodologyVersion(session.user.id),
  ]);

  let plan;
  try {
    plan = await generateTeamSessionPlan({
      teamName: team.name,
      members: team.members.map((m) => ({
        name: m.athlete.name,
        priorities: (m.athlete.aiPriorities as { skill: string; reason: string }[] | null) ?? [],
      })),
      durationMinutes: parsed.data.durationMinutes,
      sessionObjective: parsed.data.objective,
      equipmentAvailable: parsed.data.equipment,
      intensity: parsed.data.intensity,
      libraryExercises,
      sportContext,
      adaptationDirective: adaptation ? formatAdaptationDirective(adaptation) : undefined,
      methodologyText: methodologyText ?? undefined,
    });
  } catch (err) {
    captureError("AI team session generation failed", err);
    return NextResponse.json({ error: "La generazione AI non è riuscita. Riprova tra poco." }, { status: 502 });
  }

  const sessionId = await persistGeneratedSession({
    coachId: session.user.id,
    teamId: team.id,
    sportId: team.sportId,
    durationMinutes: parsed.data.durationMinutes,
    plan,
    exerciseFormat: "TEAM",
    adaptationNote: adaptation ? formatAdaptationNote(adaptation) : undefined,
    methodologyVersion,
  });

  track("team_session_generated", session.user.id, { teamId: team.id, sessionId });

  return NextResponse.json({ sessionId });
}
