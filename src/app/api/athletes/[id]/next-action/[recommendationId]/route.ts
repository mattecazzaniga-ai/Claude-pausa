import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recommendationFeedbackSchema } from "@/lib/validation";
import { track } from "@/lib/analytics";
import { recordCoachFeedbackSignal } from "@/lib/intelligence/coach-brain";

/** Master prompt §27: 👍/👎 on a recommendation — the minimum signal for future Coach Brain learning. */
export async function PATCH(req: Request, { params }: { params: { id: string; recommendationId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const recommendation = await prisma.coachingRecommendation.findUnique({ where: { id: params.recommendationId } });
  if (!recommendation || recommendation.coachId !== session.user.id || recommendation.athleteId !== params.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = recommendationFeedbackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dati non validi" }, { status: 400 });
  }

  const updated = await prisma.coachingRecommendation.update({
    where: { id: recommendation.id },
    data: { feedback: parsed.data.feedback, feedbackReason: parsed.data.feedbackReason || undefined },
  });

  track("recommendation_feedback_recorded", session.user.id, { recommendationId: recommendation.id, feedback: parsed.data.feedback });

  const feedbackLabel = parsed.data.feedback === "USEFUL" ? "utile" : "non utile";
  await recordCoachFeedbackSignal(
    session.user.id,
    "RECOMMENDATION_FEEDBACK",
    `Ha segnato come ${feedbackLabel} una raccomandazione di tipo ${recommendation.actionType} ("${recommendation.priorityLabel}")` +
      (parsed.data.feedbackReason ? `: motivo indicato "${parsed.data.feedbackReason}"` : "."),
    { actionType: recommendation.actionType, feedback: parsed.data.feedback, feedbackReason: parsed.data.feedbackReason ?? null },
    { athleteId: recommendation.athleteId ?? undefined },
  );

  return NextResponse.json({ recommendation: updated });
}
