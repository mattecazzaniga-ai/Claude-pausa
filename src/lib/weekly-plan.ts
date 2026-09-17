import { prisma } from "@/lib/prisma";
import { buildAthleteIntelligenceContext, buildTeamIntelligenceContext } from "@/lib/intelligence/context";
import { generateWeeklyPlanSkeleton, type PlanIntensity } from "@/lib/ai-weekly-plan";
import { getSportProfile, formatSportProfileForPrompt } from "@/lib/sport";
import { getMethodologyPromptText, getCurrentMethodologyVersion } from "@/lib/methodology";
import { generateSessionPlan, generateTeamSessionPlan, type LibraryExercise } from "@/lib/ai-session";
import { persistGeneratedSession } from "@/lib/create-training-session";
import { computeAdaptationSignal, computeTeamAdaptationSignal, formatAdaptationDirective, formatAdaptationNote } from "@/lib/adaptive-training";
import { getActiveInjuries, formatInjuriesForPrompt, formatInjuryAdaptationNote } from "@/lib/injuries";

/**
 * Weekly Training Plan — orchestration layer. Master prompt feedback:
 * "l'AI deve essere più precisa su carico/scarico" + "posso impostare quante
 * volte a settimana mi alleno" + "sport come il triathlon devono avere
 * allenamenti mirati per disciplina". Generates the week's SKELETON (phase +
 * one slot per session) via lib/ai-weekly-plan.ts, then each slot is filled
 * into a real session by reusing the exact same generateSessionPlan /
 * generateTeamSessionPlan + persistGeneratedSession already used by the
 * single-session generator — no second, duplicate session engine.
 */

const INTENSITY_LABEL_IT: Record<PlanIntensity, string> = {
  ALTA: "Alta (carico elevato)",
  MEDIA: "Media",
  BASSA: "Bassa (recupero attivo / tecnica)",
};

/** Monday-based week start, used only to label/identify a generated plan. */
function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function getWeeklyPlanById(planId: string) {
  return prisma.weeklyTrainingPlan.findUnique({ where: { id: planId }, include: { slots: { orderBy: { order: "asc" } } } });
}

export async function getCurrentAthleteWeeklyPlan(athleteId: string) {
  return prisma.weeklyTrainingPlan.findFirst({
    where: { athleteId },
    orderBy: { createdAt: "desc" },
    include: { slots: { orderBy: { order: "asc" } } },
  });
}

export async function getCurrentTeamWeeklyPlan(teamId: string) {
  return prisma.weeklyTrainingPlan.findFirst({
    where: { teamId },
    orderBy: { createdAt: "desc" },
    include: { slots: { orderBy: { order: "asc" } } },
  });
}

async function persistPlanSkeleton(params: { coachId: string; athleteId?: string; teamId?: string; sessionsPerWeek: number; generated: Awaited<ReturnType<typeof generateWeeklyPlanSkeleton>> }) {
  if (params.generated.slots.length !== params.sessionsPerWeek) {
    throw new Error("La generazione AI non ha prodotto il numero di sessioni richiesto. Riprova.");
  }

  const created = await prisma.weeklyTrainingPlan.create({
    data: {
      coachId: params.coachId,
      athleteId: params.athleteId,
      teamId: params.teamId,
      weekStartDate: startOfWeek(new Date()),
      sessionsPerWeek: params.sessionsPerWeek,
      phase: params.generated.phase,
      rationale: params.generated.rationale,
      slots: {
        create: params.generated.slots.map((s) => ({
          order: s.order,
          intensity: s.intensity,
          discipline: s.discipline || null,
          focus: s.focus,
        })),
      },
    },
  });

  return getWeeklyPlanById(created.id);
}

export async function createAthleteWeeklyPlan(athleteId: string, sessionsPerWeek: number) {
  const athlete = await prisma.athlete.findUnique({ where: { id: athleteId } });
  if (!athlete) throw new Error("Athlete not found");

  const [context, sportProfile, methodologyText] = await Promise.all([
    buildAthleteIntelligenceContext(athleteId),
    getSportProfile(athlete.sportId),
    getMethodologyPromptText(athlete.coachId),
  ]);

  const generated = await generateWeeklyPlanSkeleton({
    context,
    sessionsPerWeek,
    disciplines: sportProfile.disciplines,
    methodologyText: methodologyText ?? undefined,
  });

  const plan = await persistPlanSkeleton({ coachId: athlete.coachId, athleteId, sessionsPerWeek, generated });
  await prisma.athlete.update({ where: { id: athleteId }, data: { trainingDaysPerWeek: sessionsPerWeek } });
  return plan;
}

export async function createTeamWeeklyPlan(teamId: string, sessionsPerWeek: number) {
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) throw new Error("Team not found");

  const [context, sportProfile, methodologyText] = await Promise.all([
    buildTeamIntelligenceContext(teamId),
    getSportProfile(team.sportId),
    getMethodologyPromptText(team.coachId),
  ]);

  const generated = await generateWeeklyPlanSkeleton({
    context,
    sessionsPerWeek,
    disciplines: sportProfile.disciplines,
    methodologyText: methodologyText ?? undefined,
  });

  const plan = await persistPlanSkeleton({ coachId: team.coachId, teamId, sessionsPerWeek, generated });
  await prisma.team.update({ where: { id: teamId }, data: { trainingDaysPerWeek: sessionsPerWeek } });
  return plan;
}

async function loadFillableSlot(slotId: string, coachId: string) {
  const slot = await prisma.plannedSessionSlot.findUnique({ where: { id: slotId }, include: { plan: true } });
  if (!slot || slot.plan.coachId !== coachId) throw new Error("Slot not found");
  if (slot.trainingSessionId) throw new Error("Questo slot ha già una sessione generata.");
  return slot;
}

export async function fillAthletePlanSlot(slotId: string, coachId: string, durationMinutes: number): Promise<string> {
  const slot = await loadFillableSlot(slotId, coachId);
  if (!slot.plan.athleteId) throw new Error("Slot not found");

  const athlete = await prisma.athlete.findUnique({ where: { id: slot.plan.athleteId }, include: { sport: true } });
  if (!athlete) throw new Error("Athlete not found");

  const libraryRows = await prisma.exercise.findMany({
    where: { coachId, sportId: athlete.sportId },
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
    getMethodologyPromptText(coachId),
    getCurrentMethodologyVersion(coachId),
  ]);
  const adaptation = computeAdaptationSignal({ latestCheckin, recentSessions });
  const injuryDirective = formatInjuriesForPrompt(activeInjuries);
  const sessionObjective = slot.discipline ? `[${slot.discipline}] ${slot.focus}` : slot.focus;

  const plan = await generateSessionPlan({
    athleteName: athlete.name,
    objectives: athlete.objectives,
    aiSummary: athlete.aiSummary,
    aiPriorities: (athlete.aiPriorities as { skill: string; reason: string }[] | null) ?? [],
    durationMinutes,
    sessionObjective,
    intensity: INTENSITY_LABEL_IT[slot.intensity],
    libraryExercises,
    sportContext,
    adaptationDirective: adaptation ? formatAdaptationDirective(adaptation) : undefined,
    injuryConstraints: injuryDirective ?? undefined,
    methodologyText: methodologyText ?? undefined,
  });

  const adaptationNoteParts = [
    adaptation ? formatAdaptationNote(adaptation) : null,
    activeInjuries.length ? formatInjuryAdaptationNote(activeInjuries) : null,
  ].filter((n): n is string => Boolean(n));

  const sessionId = await persistGeneratedSession({
    coachId,
    athleteId: athlete.id,
    sportId: athlete.sportId,
    durationMinutes,
    plan,
    adaptationNote: adaptationNoteParts.length ? adaptationNoteParts.join(" ") : undefined,
    methodologyVersion,
  });

  await prisma.plannedSessionSlot.update({ where: { id: slotId }, data: { trainingSessionId: sessionId } });
  return sessionId;
}

export async function fillTeamPlanSlot(slotId: string, coachId: string, durationMinutes: number): Promise<string> {
  const slot = await loadFillableSlot(slotId, coachId);
  if (!slot.plan.teamId) throw new Error("Slot not found");

  const team = await prisma.team.findUnique({
    where: { id: slot.plan.teamId },
    include: { sport: true, members: { include: { athlete: true } } },
  });
  if (!team) throw new Error("Team not found");

  const libraryRows = await prisma.exercise.findMany({
    where: { coachId, sportId: team.sportId },
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
  const [methodologyText, methodologyVersion] = await Promise.all([getMethodologyPromptText(coachId), getCurrentMethodologyVersion(coachId)]);
  const sessionObjective = slot.discipline ? `[${slot.discipline}] ${slot.focus}` : slot.focus;

  const plan = await generateTeamSessionPlan({
    teamName: team.name,
    members: team.members.map((m) => ({
      name: m.athlete.name,
      priorities: (m.athlete.aiPriorities as { skill: string; reason: string }[] | null) ?? [],
    })),
    durationMinutes,
    sessionObjective,
    intensity: INTENSITY_LABEL_IT[slot.intensity],
    libraryExercises,
    sportContext,
    adaptationDirective: adaptation ? formatAdaptationDirective(adaptation) : undefined,
    methodologyText: methodologyText ?? undefined,
  });

  const sessionId = await persistGeneratedSession({
    coachId,
    teamId: team.id,
    sportId: team.sportId,
    durationMinutes,
    plan,
    exerciseFormat: "TEAM",
    adaptationNote: adaptation ? formatAdaptationNote(adaptation) : undefined,
    methodologyVersion,
  });

  await prisma.plannedSessionSlot.update({ where: { id: slotId }, data: { trainingSessionId: sessionId } });
  return sessionId;
}
