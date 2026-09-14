import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAiConfigured } from "@/lib/ai";
import { buildAthleteIntelligenceContext } from "@/lib/intelligence/context";
import { generateNextBestAction } from "@/lib/intelligence/next-best-action";
import { refreshCoachBrainIfStale, getCoachBrainPromptText } from "@/lib/intelligence/coach-brain";
import { rateLimit } from "@/lib/rate-limit";
import { track } from "@/lib/analytics";

/** Returns the most recently generated recommendation, if any — no AI call, just what's cached. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const athlete = await prisma.athlete.findUnique({ where: { id: params.id } });
  if (!athlete || athlete.coachId !== session.user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const recommendation = await prisma.coachingRecommendation.findFirst({
    where: { athleteId: params.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ recommendation });
}

/** Master prompt §5-6: generates a fresh Next Best Action from everything currently known about this athlete. */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isAiConfigured) return NextResponse.json({ error: "L'AI non è configurata su questo ambiente." }, { status: 503 });

  if (!rateLimit(`next-action:${session.user.id}`, 15, 60 * 1000)) {
    return NextResponse.json({ error: "Troppe richieste, rallenta un attimo." }, { status: 429 });
  }

  const athlete = await prisma.athlete.findUnique({ where: { id: params.id } });
  if (!athlete || athlete.coachId !== session.user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    await refreshCoachBrainIfStale(session.user.id);
    const [context, coachBrainText] = await Promise.all([
      buildAthleteIntelligenceContext(athlete.id),
      getCoachBrainPromptText(session.user.id),
    ]);
    const action = await generateNextBestAction(context, coachBrainText);

    const recommendation = await prisma.coachingRecommendation.create({
      data: {
        coachId: session.user.id,
        athleteId: athlete.id,
        actionType: action.actionType,
        priorityLabel: action.priorityLabel,
        facts: action.facts,
        pattern: action.pattern,
        recommendation: action.recommendation,
        confidence: action.confidence,
        missingData: action.missingData,
        suggestedObjective: action.suggestedSession?.objective,
        suggestedDurationMinutes: action.suggestedSession?.durationMinutes,
      },
    });

    track("next_action_generated", session.user.id, { athleteId: athlete.id, actionType: action.actionType });

    return NextResponse.json({ recommendation });
  } catch (err) {
    console.error("Next best action generation failed", err);
    return NextResponse.json({ error: "La generazione AI non è riuscita. Riprova tra poco." }, { status: 502 });
  }
}
