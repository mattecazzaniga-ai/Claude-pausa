import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createEvaluationSchema } from "@/lib/validation";
import { getEvaluationCriteria, buildComparison } from "@/lib/evaluation";
import { getSportProfile, formatSportProfileForPrompt } from "@/lib/sport";
import { isAiConfigured } from "@/lib/ai";
import { analyzeEvaluationProgress } from "@/lib/ai-evaluation";
import { rateLimit } from "@/lib/rate-limit";
import { track } from "@/lib/analytics";
import { captureError } from "@/lib/monitoring";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const athlete = await prisma.athlete.findUnique({ where: { id: params.id } });
  if (!athlete || athlete.coachId !== session.user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [criteria, evaluations] = await Promise.all([
    getEvaluationCriteria(athlete.sportId, session.user.id),
    prisma.evaluation.findMany({
      where: { athleteId: athlete.id },
      orderBy: { evaluatedAt: "asc" },
      include: { scores: true },
    }),
  ]);

  const comparison = buildComparison(criteria, evaluations);

  return NextResponse.json({
    criteria,
    evaluations: evaluations.slice().reverse(), // most recent first for the history list
    comparison,
  });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!rateLimit(`evaluation:${session.user.id}`, 20, 60 * 1000)) {
    return NextResponse.json({ error: "Troppe richieste, rallenta un attimo." }, { status: 429 });
  }

  const athlete = await prisma.athlete.findUnique({ where: { id: params.id }, include: { sport: true } });
  if (!athlete || athlete.coachId !== session.user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = createEvaluationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dati non validi" }, { status: 400 });
  }

  const criteria = await getEvaluationCriteria(athlete.sportId, session.user.id);
  const validCriterionIds = new Set(criteria.map((c) => c.id));
  const validScores = parsed.data.scores.filter((s) => validCriterionIds.has(s.criterionId));
  if (validScores.length === 0) {
    return NextResponse.json({ error: "Nessuno dei criteri inviati è valido." }, { status: 400 });
  }

  const priorEvaluations = await prisma.evaluation.findMany({
    where: { athleteId: athlete.id },
    orderBy: { evaluatedAt: "asc" },
    include: { scores: true },
  });
  const kind = priorEvaluations.length === 0 ? "INITIAL" : "PERIODIC";

  const evaluation = await prisma.evaluation.create({
    data: {
      coachId: session.user.id,
      athleteId: athlete.id,
      kind,
      notes: parsed.data.notes || undefined,
      scores: { create: validScores.map((s) => ({ criterionId: s.criterionId, value: s.value, note: s.note || undefined })) },
    },
    include: { scores: true },
  });

  track("evaluation_created", session.user.id, { athleteId: athlete.id, evaluationId: evaluation.id, kind });

  // Only a periodic evaluation has something to compare against — the AI
  // analysis (and the priorities it produces) closes the loop by feeding
  // straight back into the athlete's cached priorities (master prompt §11).
  if (kind === "PERIODIC" && isAiConfigured) {
    try {
      const comparison = buildComparison(criteria, [...priorEvaluations, evaluation]);
      const sportProfile = await getSportProfile(athlete.sportId);
      const sportContext = formatSportProfileForPrompt(athlete.sport.name, sportProfile);

      const analysis = await analyzeEvaluationProgress({
        subjectName: athlete.name,
        sportContext,
        comparisons: comparison,
        notes: parsed.data.notes ?? undefined,
      });

      await prisma.evaluation.update({ where: { id: evaluation.id }, data: { aiAnalysis: analysis.narrative } });
      await prisma.athlete.update({
        where: { id: athlete.id },
        data: {
          aiSummary: analysis.narrative,
          aiPriorities: analysis.priorities,
          aiSummaryUpdatedAt: new Date(),
        },
      });

      return NextResponse.json({ evaluation: { ...evaluation, aiAnalysis: analysis.narrative }, athleteSummary: analysis });
    } catch (err) {
      captureError("AI evaluation analysis failed", err);
      // The evaluation itself is already saved — analysis failing shouldn't lose the coach's work.
      return NextResponse.json({ evaluation, aiError: "L'analisi AI non è riuscita, ma la valutazione è salvata." });
    }
  }

  return NextResponse.json({ evaluation });
}
