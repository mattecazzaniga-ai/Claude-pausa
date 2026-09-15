import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAiConfigured } from "@/lib/ai";
import { buildAthleteIntelligenceContext } from "@/lib/intelligence/context";
import { answerCoachQuestion, isValidQuestion, type ChatTurn } from "@/lib/intelligence/chat";
import { rateLimit } from "@/lib/rate-limit";
import { track } from "@/lib/analytics";
import { captureError } from "@/lib/monitoring";

/**
 * Deliberately stateless server-side: the conversation lives in the
 * browser tab, not the database — a real "foundation" feature (per the
 * master prompt's own "AI chat foundation, not a full build" scoping),
 * not a chat history product yet.
 */
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isAiConfigured) return NextResponse.json({ error: "L'AI non è configurata su questo ambiente." }, { status: 503 });

  if (!rateLimit(`athlete-chat:${session.user.id}`, 20, 60 * 1000)) {
    return NextResponse.json({ error: "Troppe richieste, rallenta un attimo." }, { status: 429 });
  }

  const athlete = await prisma.athlete.findUnique({ where: { id: params.id } });
  if (!athlete || athlete.coachId !== session.user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!isValidQuestion(body?.question)) {
    return NextResponse.json({ error: "Scrivi una domanda (max 500 caratteri)." }, { status: 400 });
  }
  const history: ChatTurn[] = Array.isArray(body?.history)
    ? body.history.filter((t: unknown): t is ChatTurn => {
        const turn = t as ChatTurn;
        return (turn?.role === "coach" || turn?.role === "assistant") && typeof turn?.text === "string";
      })
    : [];

  try {
    const context = await buildAthleteIntelligenceContext(athlete.id);
    const answer = await answerCoachQuestion(context, body.question.trim(), history);

    track("athlete_chat_question_asked", session.user.id, { athleteId: athlete.id });

    return NextResponse.json({ answer });
  } catch (err) {
    captureError("Athlete chat failed", err);
    return NextResponse.json({ error: "La generazione AI non è riuscita. Riprova tra poco." }, { status: 502 });
  }
}
