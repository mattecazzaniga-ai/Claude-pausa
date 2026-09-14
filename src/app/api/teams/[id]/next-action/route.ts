import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAiConfigured } from "@/lib/ai";
import { buildTeamIntelligenceContext } from "@/lib/intelligence/context";
import { generateNextBestAction } from "@/lib/intelligence/next-best-action";
import { rateLimit } from "@/lib/rate-limit";
import { track } from "@/lib/analytics";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const team = await prisma.team.findUnique({ where: { id: params.id } });
  if (!team || team.coachId !== session.user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const recommendation = await prisma.coachingRecommendation.findFirst({
    where: { teamId: params.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ recommendation });
}

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isAiConfigured) return NextResponse.json({ error: "L'AI non è configurata su questo ambiente." }, { status: 503 });

  if (!rateLimit(`next-action:${session.user.id}`, 15, 60 * 1000)) {
    return NextResponse.json({ error: "Troppe richieste, rallenta un attimo." }, { status: 429 });
  }

  const team = await prisma.team.findUnique({ where: { id: params.id } });
  if (!team || team.coachId !== session.user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const context = await buildTeamIntelligenceContext(team.id);
    const action = await generateNextBestAction(context);

    const recommendation = await prisma.coachingRecommendation.create({
      data: {
        coachId: session.user.id,
        teamId: team.id,
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

    track("next_action_generated", session.user.id, { teamId: team.id, actionType: action.actionType });

    return NextResponse.json({ recommendation });
  } catch (err) {
    console.error("Next best action generation failed", err);
    return NextResponse.json({ error: "La generazione AI non è riuscita. Riprova tra poco." }, { status: 502 });
  }
}
