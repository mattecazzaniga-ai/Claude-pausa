import { prisma } from "@/lib/prisma";
import { generateEvaluationCriteria } from "@/lib/ai-evaluation-criteria";
import { isAiConfigured } from "@/lib/ai";

/**
 * Ensures a sport has a default (shared, coachId=null) set of evaluation
 * criteria, generating one via AI on first real use if it doesn't. Same
 * lazy/cached pattern as ensureSportTaxonomy/ensureSportProfile.
 */
export async function ensureEvaluationCriteria(sportId: string): Promise<void> {
  const count = await prisma.evaluationCriterion.count({ where: { sportId, coachId: null } });
  if (count > 0) return;
  if (!isAiConfigured) return;

  const sport = await prisma.sport.findUnique({ where: { id: sportId } });
  if (!sport) return;

  let generated;
  try {
    generated = await generateEvaluationCriteria(sport.name);
  } catch (err) {
    console.error("Evaluation criteria generation failed", sportId, err);
    return;
  }

  let order = 0;
  for (const category of generated.categories) {
    for (const criterion of category.criteria) {
      await prisma.evaluationCriterion.create({
        data: {
          sportId,
          coachId: null,
          category: category.name,
          name: criterion.name,
          scoreType: criterion.scoreType,
          targetLevel: criterion.targetLevel || undefined,
          order: order++,
        },
      });
    }
  }
}

/** Shared sport-default criteria + this coach's own custom ones, in one ordered list. */
export async function getEvaluationCriteria(sportId: string, coachId: string) {
  await ensureEvaluationCriteria(sportId);
  return prisma.evaluationCriterion.findMany({
    where: { sportId, OR: [{ coachId: null }, { coachId }] },
    orderBy: [{ category: "asc" }, { order: "asc" }],
  });
}

export type ComparisonRow = {
  criterionId: string;
  category: string;
  name: string;
  scoreType: string;
  baseline: string | null;
  previous: string | null;
  current: string | null;
};

/**
 * Master prompt §9: baseline vs previous vs current, per criterion, from the
 * ordered evaluation history — only for criteria the latest evaluation
 * actually scored (a coach may add criteria later that older evaluations
 * never had).
 */
export function buildComparison(
  criteria: { id: string; category: string; name: string; scoreType: string }[],
  evaluationsAsc: { scores: { criterionId: string; value: string }[] }[]
): ComparisonRow[] {
  if (evaluationsAsc.length === 0) return [];
  const baselineEval = evaluationsAsc[0];
  const currentEval = evaluationsAsc[evaluationsAsc.length - 1];
  const previousEval = evaluationsAsc.length >= 2 ? evaluationsAsc[evaluationsAsc.length - 2] : null;

  return criteria
    .map((c) => ({
      criterionId: c.id,
      category: c.category,
      name: c.name,
      scoreType: c.scoreType,
      baseline: baselineEval.scores.find((s) => s.criterionId === c.id)?.value ?? null,
      previous: previousEval?.scores.find((s) => s.criterionId === c.id)?.value ?? null,
      current: currentEval.scores.find((s) => s.criterionId === c.id)?.value ?? null,
    }))
    .filter((row) => row.current !== null);
}
