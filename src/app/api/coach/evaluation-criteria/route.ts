import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getEvaluationCriteria } from "@/lib/evaluation";
import { createEvaluationCriterionSchema } from "@/lib/validation";
import { track } from "@/lib/analytics";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const coach = await prisma.coach.findUnique({ where: { id: session.user.id }, select: { primarySportId: true } });
  if (!coach?.primarySportId) return NextResponse.json({ error: "Seleziona prima il tuo sport principale.", code: "SPORT_REQUIRED" }, { status: 409 });

  const criteria = await getEvaluationCriteria(coach.primarySportId, session.user.id);
  return NextResponse.json({ criteria });
}

/** Master prompt §6: a coach can add their own evaluation criteria on top of the sport's shared default set. */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const coach = await prisma.coach.findUnique({ where: { id: session.user.id }, select: { primarySportId: true } });
  if (!coach?.primarySportId) return NextResponse.json({ error: "Seleziona prima il tuo sport principale.", code: "SPORT_REQUIRED" }, { status: 409 });

  const body = await req.json().catch(() => null);
  const parsed = createEvaluationCriterionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dati non validi" }, { status: 400 });
  }

  const maxOrder = await prisma.evaluationCriterion.aggregate({
    where: { sportId: coach.primarySportId, coachId: session.user.id },
    _max: { order: true },
  });

  const criterion = await prisma.evaluationCriterion.create({
    data: {
      sportId: coach.primarySportId,
      coachId: session.user.id,
      category: parsed.data.category,
      name: parsed.data.name,
      scoreType: parsed.data.scoreType,
      targetLevel: parsed.data.targetLevel || undefined,
      notes: parsed.data.notes || undefined,
      order: (maxOrder._max.order ?? 0) + 1,
    },
  });

  track("evaluation_criterion_created", session.user.id, { criterionId: criterion.id });

  return NextResponse.json({ criterion });
}
