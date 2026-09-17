import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildAthleteIntelligenceContext } from "@/lib/intelligence/context";
import { computeMainGap } from "@/lib/intelligence/gap-engine";
import { rateLimit } from "@/lib/rate-limit";
import { track } from "@/lib/analytics";
import { captureError } from "@/lib/monitoring";

/**
 * Master prompt §13-14 (Performance Gap Engine) — ephemeral, same pattern as
 * /diagnose and /performance-level. No isAiConfigured gate up front:
 * computeMainGap short-circuits to hasEnoughData=false without calling the AI
 * when there's no eligible quantitative objective, so that answer works even
 * without GEMINI_API_KEY.
 */
export async function POST(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!rateLimit(`gap:${session.user.id}`, 15, 60 * 1000)) {
    return NextResponse.json({ error: "Troppe richieste, rallenta un attimo." }, { status: 429 });
  }

  const athlete = await prisma.athlete.findUnique({ where: { id: params.id } });
  if (!athlete || athlete.coachId !== session.user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const context = await buildAthleteIntelligenceContext(athlete.id);
    const gap = await computeMainGap(context);

    track("main_gap_computed", session.user.id, { athleteId: athlete.id, hasEnoughData: gap.hasEnoughData });

    return NextResponse.json({ gap });
  } catch (err) {
    if (err instanceof Error && err.message.includes("AI not configured")) {
      return NextResponse.json({ error: "L'AI non è configurata su questo ambiente." }, { status: 503 });
    }
    captureError("Main gap computation failed", err);
    return NextResponse.json({ error: "La generazione AI non è riuscita. Riprova tra poco." }, { status: 502 });
  }
}
