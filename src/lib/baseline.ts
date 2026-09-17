import { prisma } from "@/lib/prisma";

export type MetricBaseline = {
  sportMetricId: string;
  name: string;
  unit: string | null;
  direction: "HIGHER_IS_BETTER" | "LOWER_IS_BETTER" | null;
  initialValue: number;
  initialDate: string;
  currentValue: number;
  currentDate: string;
  /** Best value ever recorded, per `direction`. Null when direction is unknown (pre-existing metric never regenerated). */
  personalBest: { value: number; date: string } | null;
  /** Best value recorded in the current calendar year. Same direction caveat as personalBest. */
  seasonBest: { value: number; date: string } | null;
};

/**
 * Master prompt §4/§6 (Baseline + starting-point profile), scoped to what's
 * genuinely new: a pure computation over the *existing* AthleteMetricValue
 * history (Smart Metrics Engine, Phase 5) — never a duplicate storage table,
 * per §27's own anti-duplication rule. An athlete's Baseline for evaluations
 * already exists (EvaluationKind.INITIAL); this fills the equivalent gap for
 * sport-specific quantitative metrics: initial -> current -> personal/season
 * best, so "how far has this athlete actually come" is answerable per metric.
 */
export async function getAthleteBaseline(athleteId: string): Promise<MetricBaseline[]> {
  const values = await prisma.athleteMetricValue.findMany({
    where: { athleteId },
    orderBy: { recordedAt: "asc" },
    include: { sportMetric: { select: { id: true, name: true, unit: true, direction: true, order: true } } },
  });

  const byMetric = new Map<string, typeof values>();
  for (const v of values) {
    const list = byMetric.get(v.sportMetricId) ?? [];
    list.push(v);
    byMetric.set(v.sportMetricId, list);
  }

  const currentYear = new Date().getFullYear();

  const baselines = Array.from(byMetric.values()).map((points): MetricBaseline => {
    const metric = points[0].sportMetric;
    const first = points[0];
    const last = points[points.length - 1];
    const direction = metric.direction;

    const best = direction ? bestPoint(points, direction) : null;
    const seasonPoints = points.filter((p) => p.recordedAt.getFullYear() === currentYear);
    const seasonBest = direction && seasonPoints.length ? bestPoint(seasonPoints, direction) : null;

    return {
      sportMetricId: metric.id,
      name: metric.name,
      unit: metric.unit,
      direction,
      initialValue: first.value,
      initialDate: first.recordedAt.toISOString(),
      currentValue: last.value,
      currentDate: last.recordedAt.toISOString(),
      personalBest: best ? { value: best.value, date: best.recordedAt.toISOString() } : null,
      seasonBest: seasonBest ? { value: seasonBest.value, date: seasonBest.recordedAt.toISOString() } : null,
    };
  });

  return baselines.sort((a, b) => a.name.localeCompare(b.name));
}

function bestPoint<T extends { value: number }>(points: T[], direction: "HIGHER_IS_BETTER" | "LOWER_IS_BETTER"): T {
  return points.reduce((best, p) => {
    if (direction === "HIGHER_IS_BETTER") return p.value > best.value ? p : best;
    return p.value < best.value ? p : best;
  }, points[0]);
}
