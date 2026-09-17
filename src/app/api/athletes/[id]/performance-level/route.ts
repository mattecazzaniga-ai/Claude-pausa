import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildAthleteIntelligenceContext } from "@/lib/intelligence/context";
import { assessPerformanceLevel } from "@/lib/intelligence/performance-level";
import { getMethodologyPromptText } from "@/lib/methodology";
import { rateLimit } from "@/lib/rate-limit";
import { track } from "@/lib/analytics";
import { captureError } from "@/lib/monitoring";

/**
 * Master prompt §6-7 — ephemeral like /diagnose: a fresh read of the current
 * evidence each time, never a stored, staleable "level". Deliberately does
 * NOT gate on isAiConfigured up front like /diagnose does: assessPerformanceLevel
 * itself short-circuits to INSUFFICIENT_DATA (no AI call) when there isn't
 * enough evidence yet, so that answer works even without GEMINI_API_KEY —
 * only a genuine assessment attempt needs the AI to be configured.
 */
export async function POST(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!rateLimit(`performance-level:${session.user.id}`, 15, 60 * 1000)) {
    return NextResponse.json({ error: "Troppe richieste, rallenta un attimo." }, { status: 429 });
  }

  const athlete = await prisma.athlete.findUnique({ where: { id: params.id } });
  if (!athlete || athlete.coachId !== session.user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const [context, methodologyText] = await Promise.all([
      buildAthleteIntelligenceContext(athlete.id),
      getMethodologyPromptText(session.user.id),
    ]);
    const assessment = await assessPerformanceLevel(context, methodologyText);

    track("performance_level_assessed", session.user.id, { athleteId: athlete.id, provenance: assessment.provenance });

    return NextResponse.json({ assessment });
  } catch (err) {
    if (err instanceof Error && err.message.includes("AI not configured")) {
      return NextResponse.json({ error: "L'AI non è configurata su questo ambiente." }, { status: 503 });
    }
    captureError("Performance level assessment failed", err);
    return NextResponse.json({ error: "La generazione AI non è riuscita. Riprova tra poco." }, { status: 502 });
  }
}
