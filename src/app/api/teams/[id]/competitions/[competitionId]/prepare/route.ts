import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSportProfile, formatSportProfileForPrompt } from "@/lib/sport";
import { isAiConfigured } from "@/lib/ai";
import { analyzeCompetitionPreparation } from "@/lib/ai-competition";
import { rateLimit } from "@/lib/rate-limit";
import { track } from "@/lib/analytics";

export async function POST(_req: Request, { params }: { params: { id: string; competitionId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isAiConfigured) return NextResponse.json({ error: "L'AI non è configurata su questo ambiente." }, { status: 503 });

  if (!rateLimit(`competition-prepare:${session.user.id}`, 15, 60 * 1000)) {
    return NextResponse.json({ error: "Troppe richieste, rallenta un attimo." }, { status: 429 });
  }

  const competition = await prisma.competition.findUnique({
    where: { id: params.competitionId },
    include: { team: { include: { sport: true, members: { include: { athlete: { select: { aiPriorities: true } } } } } } },
  });
  if (!competition || competition.coachId !== session.user.id || competition.teamId !== params.id || !competition.team) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const daysUntil = Math.max(0, Math.ceil((+competition.scheduledAt - Date.now()) / (24 * 60 * 60 * 1000)));

  // No single cached summary for a team — aggregate each member's current top priority, deduped.
  const seen = new Set<string>();
  const currentPriorities: { skill: string; reason: string }[] = [];
  for (const member of competition.team.members) {
    const priorities = (member.athlete.aiPriorities as { skill: string; reason: string }[] | null) ?? [];
    const top = priorities[0];
    if (top && !seen.has(top.skill.toLowerCase())) {
      seen.add(top.skill.toLowerCase());
      currentPriorities.push(top);
    }
  }

  try {
    const sportProfile = await getSportProfile(competition.team.sportId);
    const sportContext = formatSportProfileForPrompt(competition.team.sport.name, sportProfile);

    const { narrative } = await analyzeCompetitionPreparation({
      subjectName: competition.team.name,
      sportContext,
      competitionName: competition.name,
      competitionType: competition.type,
      daysUntil,
      opponent: competition.opponent,
      importance: competition.importance,
      currentPriorities,
      preNotes: competition.preNotes,
    });

    const updated = await prisma.competition.update({ where: { id: competition.id }, data: { aiPreAnalysis: narrative } });

    track("competition_prepared", session.user.id, { competitionId: competition.id });

    return NextResponse.json({ competition: updated });
  } catch (err) {
    console.error("AI competition preparation failed", err);
    return NextResponse.json({ error: "La generazione AI non è riuscita. Riprova tra poco." }, { status: 502 });
  }
}
