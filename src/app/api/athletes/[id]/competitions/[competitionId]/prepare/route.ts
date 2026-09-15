import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSportProfile, formatSportProfileForPrompt } from "@/lib/sport";
import { isAiConfigured } from "@/lib/ai";
import { analyzeCompetitionPreparation } from "@/lib/ai-competition";
import { rateLimit } from "@/lib/rate-limit";
import { track } from "@/lib/analytics";
import { captureError } from "@/lib/monitoring";

/** Master prompt §18/25: on-demand pre-competition preparation advice, generated fresh each time so it reflects the athlete's current form as the date approaches. */
export async function POST(_req: Request, { params }: { params: { id: string; competitionId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isAiConfigured) return NextResponse.json({ error: "L'AI non è configurata su questo ambiente." }, { status: 503 });

  if (!rateLimit(`competition-prepare:${session.user.id}`, 15, 60 * 1000)) {
    return NextResponse.json({ error: "Troppe richieste, rallenta un attimo." }, { status: 429 });
  }

  const competition = await prisma.competition.findUnique({
    where: { id: params.competitionId },
    include: { athlete: { include: { sport: true } } },
  });
  if (!competition || competition.coachId !== session.user.id || competition.athleteId !== params.id || !competition.athlete) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const daysUntil = Math.max(0, Math.ceil((+competition.scheduledAt - Date.now()) / (24 * 60 * 60 * 1000)));

  try {
    const sportProfile = await getSportProfile(competition.athlete.sportId);
    const sportContext = formatSportProfileForPrompt(competition.athlete.sport.name, sportProfile);

    const { narrative } = await analyzeCompetitionPreparation({
      subjectName: competition.athlete.name,
      sportContext,
      competitionName: competition.name,
      competitionType: competition.type,
      daysUntil,
      opponent: competition.opponent,
      importance: competition.importance,
      currentSummary: competition.athlete.aiSummary,
      currentPriorities: (competition.athlete.aiPriorities as { skill: string; reason: string }[] | null) ?? [],
      preNotes: competition.preNotes,
    });

    const updated = await prisma.competition.update({ where: { id: competition.id }, data: { aiPreAnalysis: narrative } });

    track("competition_prepared", session.user.id, { competitionId: competition.id });

    return NextResponse.json({ competition: updated });
  } catch (err) {
    captureError("AI competition preparation failed", err);
    return NextResponse.json({ error: "La generazione AI non è riuscita. Riprova tra poco." }, { status: 502 });
  }
}
