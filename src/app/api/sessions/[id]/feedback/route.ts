import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sessionFeedbackSchema } from "@/lib/validation";
import { track } from "@/lib/analytics";
import { recordCoachFeedbackSignal } from "@/lib/intelligence/coach-brain";

/** Master prompt §33: end-of-session feedback, minimum effort — a quick rating plus an optional note. */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const trainingSession = await prisma.trainingSession.findUnique({ where: { id: params.id } });
  if (!trainingSession || trainingSession.coachId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = sessionFeedbackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dati non validi" }, { status: 400 });
  }

  const updated = await prisma.trainingSession.update({
    where: { id: trainingSession.id },
    data: { feedbackRating: parsed.data.rating, feedbackNote: parsed.data.note || undefined },
  });

  track("session_feedback_recorded", session.user.id, { sessionId: trainingSession.id, rating: parsed.data.rating });

  const RATING_LABEL: Record<string, string> = {
    EXCELLENT: "eccellente",
    GOOD: "buona",
    AVERAGE: "nella media",
    NEEDS_WORK: "da migliorare",
  };
  await recordCoachFeedbackSignal(
    session.user.id,
    "SESSION_FEEDBACK",
    `Ha valutato una sessione di allenamento come "${RATING_LABEL[parsed.data.rating] ?? parsed.data.rating}"` +
      (parsed.data.note ? `, con nota: "${parsed.data.note}"` : "."),
    { rating: parsed.data.rating, note: parsed.data.note ?? null },
  );

  return NextResponse.json({ session: updated });
}
