import { prisma } from "@/lib/prisma";
import { buildAthleteIntelligenceContext, type IntelligenceContext } from "@/lib/intelligence/context";
import { getAthleteBaseline, type MetricBaseline } from "@/lib/baseline";
import { computeOverallInjuryStatus, type OverallInjuryStatus } from "@/lib/injuries";
import { getMethodologyPrinciples, getCurrentMethodologyVersion } from "@/lib/methodology";

export type AthleteDigitalTwin = {
  athleteId: string;
  name: string;
  sportName: string;
  level: string | null;
  isSelf: boolean;
  overallInjuryStatus: OverallInjuryStatus;
  activeInjuries: IntelligenceContext["activeInjuries"];
  aiSummary: string | null;
  aiSummaryUpdatedAt: string | null;
  priorities: IntelligenceContext["aiPriorities"];
  methodology: { version: number | null; principleCount: number };
  baseline: MetricBaseline[];
  evaluationComparison: IntelligenceContext["evaluationComparison"];
  daysSinceLastEvaluation: number | null;
  activeObjectives: IntelligenceContext["activeObjectives"];
  recentCheckins: IntelligenceContext["recentCheckins"];
  daysSinceLastSession: number | null;
  upcomingCompetition: IntelligenceContext["upcomingCompetition"];
};

/**
 * Master prompt's "Athlete Digital Twin" framing: one coherent snapshot of
 * everything the app already knows about an athlete, instead of the coach
 * having to piece it together across seven tabs. Deliberately NOT a new
 * storage entity or a fresh AI call (§27's anti-duplication rule) — it's a
 * pure read-time aggregation over buildAthleteIntelligenceContext (the same
 * evidence every AI decision already reasons over) plus the two pieces that
 * context doesn't carry: per-metric baseline/PB/SB and the coach's
 * methodology status. Safe to call with no GEMINI_API_KEY — nothing here
 * calls the AI.
 */
export async function getAthleteDigitalTwin(athleteId: string): Promise<AthleteDigitalTwin> {
  const athlete = await prisma.athlete.findUnique({
    where: { id: athleteId },
    select: { coachId: true, name: true, level: true, isSelf: true, aiSummaryUpdatedAt: true },
  });
  if (!athlete) throw new Error("Athlete not found");

  const [context, baseline, methodologyPrinciples, methodologyVersion] = await Promise.all([
    buildAthleteIntelligenceContext(athleteId),
    getAthleteBaseline(athleteId),
    getMethodologyPrinciples(athlete.coachId),
    getCurrentMethodologyVersion(athlete.coachId),
  ]);

  return {
    athleteId,
    name: athlete.name,
    sportName: context.sportName,
    level: athlete.level,
    isSelf: athlete.isSelf,
    overallInjuryStatus: computeOverallInjuryStatus(context.activeInjuries),
    activeInjuries: context.activeInjuries,
    aiSummary: context.aiSummary,
    aiSummaryUpdatedAt: athlete.aiSummaryUpdatedAt?.toISOString() ?? null,
    priorities: context.aiPriorities,
    methodology: { version: methodologyVersion, principleCount: methodologyPrinciples.length },
    baseline,
    evaluationComparison: context.evaluationComparison,
    daysSinceLastEvaluation: context.daysSinceLastEvaluation,
    activeObjectives: context.activeObjectives,
    recentCheckins: context.recentCheckins,
    daysSinceLastSession: context.daysSinceLastSession,
    upcomingCompetition: context.upcomingCompetition,
  };
}
