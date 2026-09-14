import { prisma } from "@/lib/prisma";
import { getSportProfile, formatSportProfileForPrompt } from "@/lib/sport";
import { getEvaluationCriteria, buildComparison, type ComparisonRow } from "@/lib/evaluation";

const RECENT_NOTES_LIMIT = 6;
const RECENT_COMPETITIONS_LIMIT = 3;
const RECENT_SESSIONS_LIMIT = 5;

export type IntelligenceContext = {
  subjectName: string;
  sportName: string;
  sportContextText: string;
  objectivesFreeText: string | null;
  aiSummary: string | null;
  aiPriorities: { skill: string; reason: string }[];
  recentNotes: { date: string; text: string; tags: { skill: string; sentiment: string }[] }[];
  evaluationComparison: ComparisonRow[];
  daysSinceLastEvaluation: number | null;
  activeObjectives: {
    title: string;
    termLength: string;
    kind: string;
    baselineValue: string | null;
    targetValue: string | null;
    currentValue: string | null;
    unit: string | null;
  }[];
  recentCompetitions: { name: string; scheduledAt: string; result: string; score: string | null; postNotes: string | null; aiPostAnalysis: string | null }[];
  upcomingCompetition: { name: string; scheduledAt: string; daysUntil: number } | null;
  recentSessions: { createdAt: string; objective: string | null; feedbackRating: string | null; feedbackNote: string | null }[];
  daysSinceLastSession: number | null;
};

/**
 * Pulls together every source the master prompt names (evaluations,
 * objectives, competitions, training/feedback history, sport context) into
 * one bounded context — capped lists, not "the whole database" — that every
 * intelligence function (Next Best Action, bottleneck diagnosis, etc.)
 * builds its prompt from. One place to fix if a source needs adjusting,
 * instead of every AI call re-deriving it.
 */
export async function buildAthleteIntelligenceContext(athleteId: string): Promise<IntelligenceContext> {
  const athlete = await prisma.athlete.findUnique({
    where: { id: athleteId },
    include: { sport: true },
  });
  if (!athlete) throw new Error("Athlete not found");

  const [sportProfile, criteria, evaluations, notes, objectives, pastCompetitions, upcomingCompetition, recentSessions] = await Promise.all([
    getSportProfile(athlete.sportId),
    getEvaluationCriteria(athlete.sportId, athlete.coachId),
    prisma.evaluation.findMany({ where: { athleteId }, orderBy: { evaluatedAt: "asc" }, include: { scores: true } }),
    prisma.sessionNote.findMany({
      where: { athleteId },
      orderBy: { sessionDate: "desc" },
      take: RECENT_NOTES_LIMIT,
      include: { tags: { include: { skill: true } } },
    }),
    prisma.objective.findMany({ where: { athleteId, status: "ACTIVE" }, orderBy: { createdAt: "desc" } }),
    prisma.competition.findMany({
      where: { athleteId, result: { not: "NOT_RECORDED" } },
      orderBy: { scheduledAt: "desc" },
      take: RECENT_COMPETITIONS_LIMIT,
    }),
    prisma.competition.findFirst({ where: { athleteId, scheduledAt: { gte: new Date() } }, orderBy: { scheduledAt: "asc" } }),
    prisma.trainingSession.findMany({
      where: { athleteId },
      orderBy: { createdAt: "desc" },
      take: RECENT_SESSIONS_LIMIT,
      select: { createdAt: true, objective: true, feedbackRating: true, feedbackNote: true },
    }),
  ]);

  const lastEvaluation = evaluations[evaluations.length - 1];
  const lastSessionNote = notes[0];

  return {
    subjectName: athlete.name,
    sportName: athlete.sport.name,
    sportContextText: formatSportProfileForPrompt(athlete.sport.name, sportProfile),
    objectivesFreeText: athlete.objectives,
    aiSummary: athlete.aiSummary,
    aiPriorities: (athlete.aiPriorities as { skill: string; reason: string }[] | null) ?? [],
    recentNotes: notes.map((n) => ({
      date: n.sessionDate.toISOString(),
      text: n.rawText,
      tags: n.tags.map((t) => ({ skill: t.skill.name, sentiment: t.sentiment })),
    })),
    evaluationComparison: buildComparison(criteria, evaluations),
    daysSinceLastEvaluation: lastEvaluation ? daysBetween(lastEvaluation.evaluatedAt, new Date()) : null,
    activeObjectives: objectives.map((o) => ({
      title: o.title,
      termLength: o.termLength,
      kind: o.kind,
      baselineValue: o.baselineValue,
      targetValue: o.targetValue,
      currentValue: o.currentValue,
      unit: o.unit,
    })),
    recentCompetitions: pastCompetitions.map((c) => ({
      name: c.name,
      scheduledAt: c.scheduledAt.toISOString(),
      result: c.result,
      score: c.score,
      postNotes: c.postNotes,
      aiPostAnalysis: c.aiPostAnalysis,
    })),
    upcomingCompetition: upcomingCompetition
      ? { name: upcomingCompetition.name, scheduledAt: upcomingCompetition.scheduledAt.toISOString(), daysUntil: daysBetween(new Date(), upcomingCompetition.scheduledAt) }
      : null,
    recentSessions: recentSessions.map((s) => ({
      createdAt: s.createdAt.toISOString(),
      objective: s.objective,
      feedbackRating: s.feedbackRating,
      feedbackNote: s.feedbackNote,
    })),
    daysSinceLastSession: lastSessionNote ? daysBetween(lastSessionNote.sessionDate, new Date()) : null,
  };
}

export async function buildTeamIntelligenceContext(teamId: string): Promise<IntelligenceContext> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: { sport: true, members: { include: { athlete: { select: { aiPriorities: true } } } } },
  });
  if (!team) throw new Error("Team not found");

  const [sportProfile, evaluationCriteria, evaluations, objectives, pastCompetitions, upcomingCompetition, recentSessions] = await Promise.all([
    getSportProfile(team.sportId),
    getEvaluationCriteria(team.sportId, team.coachId),
    prisma.evaluation.findMany({ where: { teamId }, orderBy: { evaluatedAt: "asc" }, include: { scores: true } }),
    prisma.objective.findMany({ where: { teamId, status: "ACTIVE" }, orderBy: { createdAt: "desc" } }),
    prisma.competition.findMany({
      where: { teamId, result: { not: "NOT_RECORDED" } },
      orderBy: { scheduledAt: "desc" },
      take: RECENT_COMPETITIONS_LIMIT,
    }),
    prisma.competition.findFirst({ where: { teamId, scheduledAt: { gte: new Date() } }, orderBy: { scheduledAt: "asc" } }),
    prisma.trainingSession.findMany({
      where: { teamId },
      orderBy: { createdAt: "desc" },
      take: RECENT_SESSIONS_LIMIT,
      select: { createdAt: true, objective: true, feedbackRating: true, feedbackNote: true },
    }),
  ]);

  // No single cached summary for a team — aggregate each member's current
  // top priority, deduped, same heuristic used for the dashboard's team focus card.
  const seen = new Set<string>();
  const aiPriorities: { skill: string; reason: string }[] = [];
  for (const member of team.members) {
    const priorities = (member.athlete.aiPriorities as { skill: string; reason: string }[] | null) ?? [];
    const top = priorities[0];
    if (top && !seen.has(top.skill.toLowerCase())) {
      seen.add(top.skill.toLowerCase());
      aiPriorities.push(top);
    }
  }

  const lastEvaluation = evaluations[evaluations.length - 1];

  return {
    subjectName: team.name,
    sportName: team.sport.name,
    sportContextText: formatSportProfileForPrompt(team.sport.name, sportProfile),
    objectivesFreeText: null,
    aiSummary: null,
    aiPriorities,
    recentNotes: [],
    evaluationComparison: buildComparison(evaluationCriteria, evaluations),
    daysSinceLastEvaluation: lastEvaluation ? daysBetween(lastEvaluation.evaluatedAt, new Date()) : null,
    activeObjectives: objectives.map((o) => ({
      title: o.title,
      termLength: o.termLength,
      kind: o.kind,
      baselineValue: o.baselineValue,
      targetValue: o.targetValue,
      currentValue: o.currentValue,
      unit: o.unit,
    })),
    recentCompetitions: pastCompetitions.map((c) => ({
      name: c.name,
      scheduledAt: c.scheduledAt.toISOString(),
      result: c.result,
      score: c.score,
      postNotes: c.postNotes,
      aiPostAnalysis: c.aiPostAnalysis,
    })),
    upcomingCompetition: upcomingCompetition
      ? { name: upcomingCompetition.name, scheduledAt: upcomingCompetition.scheduledAt.toISOString(), daysUntil: daysBetween(new Date(), upcomingCompetition.scheduledAt) }
      : null,
    recentSessions: recentSessions.map((s) => ({
      createdAt: s.createdAt.toISOString(),
      objective: s.objective,
      feedbackRating: s.feedbackRating,
      feedbackNote: s.feedbackNote,
    })),
    daysSinceLastSession: recentSessions[0] ? daysBetween(recentSessions[0].createdAt, new Date()) : null,
  };
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000));
}

/** Renders the context as compact prompt text — shared so every intelligence prompt uses the same evidence framing. */
export function formatContextForPrompt(ctx: IntelligenceContext): string {
  const lines: string[] = [ctx.sportContextText, "", `Soggetto: ${ctx.subjectName}`];

  if (ctx.objectivesFreeText) lines.push(`Obiettivi generali dichiarati dal coach: ${ctx.objectivesFreeText}`);
  if (ctx.aiSummary) lines.push(`Sintesi AI più recente: ${ctx.aiSummary}`);

  if (ctx.aiPriorities.length) {
    lines.push("Priorità attuali registrate:");
    ctx.aiPriorities.forEach((p) => lines.push(`- ${p.skill}: ${p.reason}`));
  }

  if (ctx.evaluationComparison.length) {
    lines.push(`Valutazioni (baseline → precedente → attuale, ${ctx.daysSinceLastEvaluation ?? "?"} giorni fa l'ultima):`);
    ctx.evaluationComparison.forEach((row) =>
      lines.push(`- [${row.category}] ${row.name}: baseline ${row.baseline ?? "N/D"}, precedente ${row.previous ?? "N/D"}, attuale ${row.current}`)
    );
  } else {
    lines.push("Nessuna valutazione registrata ancora.");
  }

  if (ctx.activeObjectives.length) {
    lines.push("Obiettivi attivi:");
    ctx.activeObjectives.forEach((o) =>
      lines.push(
        `- ${o.title} (${o.termLength})${o.kind === "QUANTITATIVE" ? `: ${o.baselineValue ?? "?"} → ${o.currentValue ?? "?"} → target ${o.targetValue ?? "?"}${o.unit ?? ""}` : ""}`
      )
    );
  }

  if (ctx.recentNotes.length) {
    lines.push(`Ultime note di sessione (dalla più recente):`);
    ctx.recentNotes.forEach((n) => {
      const tagsText = n.tags.length ? ` [${n.tags.map((t) => `${t.skill}:${t.sentiment}`).join(", ")}]` : "";
      lines.push(`- ${new Date(n.date).toLocaleDateString("it-IT")}: "${n.text}"${tagsText}`);
    });
  }

  if (ctx.recentSessions.length) {
    lines.push(`Ultime sessioni generate (${ctx.daysSinceLastSession ?? "?"} giorni fa l'ultima):`);
    ctx.recentSessions.forEach((s) => {
      const parts = [new Date(s.createdAt).toLocaleDateString("it-IT")];
      if (s.objective) parts.push(s.objective);
      if (s.feedbackRating) parts.push(`esito: ${s.feedbackRating}`);
      if (s.feedbackNote) parts.push(`nota: "${s.feedbackNote}"`);
      lines.push(`- ${parts.join(" — ")}`);
    });
  } else {
    lines.push("Nessuna sessione generata ancora.");
  }

  if (ctx.recentCompetitions.length) {
    lines.push("Competizioni recenti:");
    ctx.recentCompetitions.forEach((c) => {
      const parts = [new Date(c.scheduledAt).toLocaleDateString("it-IT"), c.name, c.result];
      if (c.score) parts.push(c.score);
      if (c.postNotes) parts.push(`osservazioni: "${c.postNotes}"`);
      if (c.aiPostAnalysis) parts.push(`analisi: "${c.aiPostAnalysis}"`);
      lines.push(`- ${parts.join(" — ")}`);
    });
  }

  if (ctx.upcomingCompetition) {
    lines.push(`Prossima competizione: ${ctx.upcomingCompetition.name} tra ${ctx.upcomingCompetition.daysUntil} giorni.`);
  }

  return lines.join("\n");
}
