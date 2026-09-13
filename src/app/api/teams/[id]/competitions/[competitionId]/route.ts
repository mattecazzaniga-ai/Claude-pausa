import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recordCompetitionResultSchema } from "@/lib/validation";
import { getSportProfile, formatSportProfileForPrompt } from "@/lib/sport";
import { isAiConfigured } from "@/lib/ai";
import { analyzeCompetitionPerformance } from "@/lib/ai-competition";
import { rateLimit } from "@/lib/rate-limit";
import { track } from "@/lib/analytics";

const RESULT_LABEL: Record<string, string> = { WIN: "Vittoria", LOSS: "Sconfitta", DRAW: "Pareggio", NOT_RECORDED: "Non registrato" };

export async function PATCH(req: Request, { params }: { params: { id: string; competitionId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!rateLimit(`competition-result:${session.user.id}`, 20, 60 * 1000)) {
    return NextResponse.json({ error: "Troppe richieste, rallenta un attimo." }, { status: 429 });
  }

  const competition = await prisma.competition.findUnique({ where: { id: params.competitionId }, include: { team: { include: { sport: true } } } });
  if (!competition || competition.coachId !== session.user.id || competition.teamId !== params.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = recordCompetitionResultSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dati non validi" }, { status: 400 });
  }

  const updated = await prisma.competition.update({
    where: { id: competition.id },
    data: { result: parsed.data.result, score: parsed.data.score || undefined, postNotes: parsed.data.postNotes || undefined },
  });

  track("competition_result_recorded", session.user.id, { competitionId: competition.id, result: parsed.data.result });

  if (!isAiConfigured || !competition.team) {
    return NextResponse.json({ competition: updated });
  }

  try {
    const sportProfile = await getSportProfile(competition.team.sportId);
    const sportContext = formatSportProfileForPrompt(competition.team.sport.name, sportProfile);

    const analysis = await analyzeCompetitionPerformance({
      subjectName: competition.team.name,
      sportContext,
      competitionName: competition.name,
      opponent: competition.opponent,
      result: RESULT_LABEL[parsed.data.result] ?? parsed.data.result,
      score: parsed.data.score,
      preNotes: competition.preNotes,
      postNotes: parsed.data.postNotes,
    });

    const withAnalysis = await prisma.competition.update({ where: { id: competition.id }, data: { aiPostAnalysis: analysis.narrative } });

    return NextResponse.json({ competition: withAnalysis, analysis });
  } catch (err) {
    console.error("AI competition analysis failed", err);
    return NextResponse.json({ competition: updated, aiError: "L'analisi AI non è riuscita, ma il risultato è salvato." });
  }
}
