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

  const team = await prisma.team.findUnique({ where: { id: params.id } });
  if (!team || team.coachId !== session.user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [criteria, evaluations] = await Promise.all([
    getEvaluationCriteria(team.sportId, session.user.id),
    prisma.evaluation.findMany({
      where: { teamId: team.id },
      orderBy: { evaluatedAt: "asc" },
      include: { scores: true },
    }),
  ]);

  const comparison = buildComparison(criteria, evaluations);

  return NextResponse.json({
    criteria,
    evaluations: evaluations.slice().reverse(),
    comparison,
  });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!rateLimit(`evaluation:${session.user.id}`, 20, 60 * 1000)) {
    return NextResponse.json({ error: "Troppe richieste, rallenta un attimo." }, { status: 429 });
  }

  const team = await prisma.team.findUnique({ where: { id: params.id }, include: { sport: true } });
  if (!team || team.coachId !== session.user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = createEvaluationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dati non validi" }, { status: 400 });
  }

  const criteria = await getEvaluationCriteria(team.sportId, session.user.id);
  const validCriterionIds = new Set(criteria.map((c) => c.id));
  const validScores = parsed.data.scores.filter((s) => validCriterionIds.has(s.criterionId));
  if (validScores.length === 0) {
    return NextResponse.json({ error: "Nessuno dei criteri inviati è valido." }, { status: 400 });
  }

  const priorEvaluations = await prisma.evaluation.findMany({
    where: { teamId: team.id },
    orderBy: { evaluatedAt: "asc" },
    include: { scores: true },
  });
  const kind = priorEvaluations.length === 0 ? "INITIAL" : "PERIODIC";

  const evaluation = await prisma.evaluation.create({
    data: {
      coachId: session.user.id,
      teamId: team.id,
      kind,
      notes: parsed.data.notes || undefined,
      scores: { create: validScores.map((s) => ({ criterionId: s.criterionId, value: s.value, note: s.note || undefined })) },
    },
    include: { scores: true },
  });

  track("evaluation_created", session.user.id, { teamId: team.id, evaluationId: evaluation.id, kind });

  if (kind === "PERIODIC" && isAiConfigured) {
    try {
      const comparison = buildComparison(criteria, [...priorEvaluations, evaluation]);
      const sportProfile = await getSportProfile(team.sportId);
      const sportContext = formatSportProfileForPrompt(team.sport.name, sportProfile);

      const analysis = await analyzeEvaluationProgress({
        subjectName: team.name,
        sportContext,
        comparisons: comparison,
        notes: parsed.data.notes ?? undefined,
      });

      await prisma.evaluation.update({ where: { id: evaluation.id }, data: { aiAnalysis: analysis.narrative } });

      return NextResponse.json({ evaluation: { ...evaluation, aiAnalysis: analysis.narrative }, analysis });
    } catch (err) {
      captureError("AI evaluation analysis failed", err);
      return NextResponse.json({ evaluation, aiError: "L'analisi AI non è riuscita, ma la valutazione è salvata." });
    }
  }

  return NextResponse.json({ evaluation });
}
