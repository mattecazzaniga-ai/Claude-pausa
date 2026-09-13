import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { bulkCreateCriteriaSchema } from "@/lib/validation";
import { track } from "@/lib/analytics";

/**
 * Saves criteria the coach has reviewed (and possibly edited) after an AI
 * import or an AI-suggested set — see master prompt §4: "The AI must NEVER
 * silently change the coach's methodology." Nothing from an import reaches
 * this table until the coach explicitly confirms it here.
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const coach = await prisma.coach.findUnique({ where: { id: session.user.id }, select: { primarySportId: true } });
  if (!coach?.primarySportId) return NextResponse.json({ error: "Seleziona prima il tuo sport principale.", code: "SPORT_REQUIRED" }, { status: 409 });

  const body = await req.json().catch(() => null);
  const parsed = bulkCreateCriteriaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dati non validi" }, { status: 400 });
  }

  const maxOrder = await prisma.evaluationCriterion.aggregate({
    where: { sportId: coach.primarySportId, coachId: session.user.id },
    _max: { order: true },
  });
  let order = (maxOrder._max.order ?? 0) + 1;

  const created = await prisma.$transaction(
    parsed.data.criteria.map((c) =>
      prisma.evaluationCriterion.create({
        data: {
          sportId: coach.primarySportId!,
          coachId: session.user.id,
          category: c.category,
          name: c.name,
          scoreType: c.scoreType,
          targetLevel: c.targetLevel || undefined,
          order: order++,
        },
      })
    )
  );

  track("evaluation_criteria_bulk_saved", session.user.id, { count: created.length });

  return NextResponse.json({ criteria: created });
}
