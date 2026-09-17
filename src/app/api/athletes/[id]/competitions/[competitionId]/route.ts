import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recordCompetitionResultSchema } from "@/lib/validation";
import { getSportProfile, formatSportProfileForPrompt } from "@/lib/sport";
import { isAiConfigured } from "@/lib/ai";
import { analyzeCompetitionPerformance } from "@/lib/ai-competition";
import { recordAthleteMemoryObservation } from "@/lib/memory";
import { rateLimit } from "@/lib/rate-limit";
import { track } from "@/lib/analytics";
import { captureError } from "@/lib/monitoring";

const RESULT_LABEL: Record<string, string> = { WIN: "Vittoria", LOSS: "Sconfitta", DRAW: "Pareggio", NOT_RECORDED: "Non registrato" };

export async function PATCH(
  req: Request,
  props: { params: Promise<{ id: string; competitionId: string }> }
) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!rateLimit(`competition-result:${session.user.id}`, 20, 60 * 1000)) {
    return NextResponse.json({ error: "Troppe richieste, rallenta un attimo." }, { status: 429 });
  }

  const competition = await prisma.competition.findUnique({ where: { id: params.competitionId }, include: { athlete: { include: { sport: true } } } });
  if (!competition || competition.coachId !== session.user.id || competition.athleteId !== params.id) {
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

  if (!isAiConfigured || !competition.athlete) {
    return NextResponse.json({ competition: updated });
  }

  try {
    const sportProfile = await getSportProfile(competition.athlete.sportId);
    const sportContext = formatSportProfileForPrompt(competition.athlete.sport.name, sportProfile);

    const analysis = await analyzeCompetitionPerformance({
      subjectName: competition.athlete.name,
      sportContext,
      competitionName: competition.name,
      opponent: competition.opponent,
      result: RESULT_LABEL[parsed.data.result] ?? parsed.data.result,
      score: parsed.data.score,
      preNotes: competition.preNotes,
      postNotes: parsed.data.postNotes,
    });

    const withAnalysis = await prisma.competition.update({ where: { id: competition.id }, data: { aiPostAnalysis: analysis.narrative } });
    await prisma.athlete.update({
      where: { id: competition.athleteId! },
      data: { aiSummary: analysis.narrative, aiPriorities: analysis.priorities, aiSummaryUpdatedAt: new Date() },
    });

    // Coaching Memory (§14): a priority that keeps resurfacing after
    // competitions is exactly the "recurring problem" the memory system
    // should notice — recordAthleteMemoryObservation only strengthens it
    // into a real pattern once the SAME topic recurs, never on one occurrence.
    // Best-effort: a memory-write failure must never hide that the analysis
    // itself already succeeded and was saved.
    try {
      for (const priority of analysis.priorities) {
        await recordAthleteMemoryObservation({
          athleteId: competition.athleteId!,
          coachId: session.user.id,
          topic: priority.skill,
          summary: `${priority.skill}: ${priority.reason} (dopo ${competition.name})`,
          source: "COMPETITION",
        });
      }
    } catch (memoryErr) {
      captureError("Recording athlete memory from competition analysis failed", memoryErr);
    }

    return NextResponse.json({ competition: withAnalysis, athleteSummary: analysis });
  } catch (err) {
    captureError("AI competition analysis failed", err);
    return NextResponse.json({ competition: updated, aiError: "L'analisi AI non è riuscita, ma il risultato è salvato." });
  }
}

/** Also removes the linked calendar entry, if any — a Competition and its CalendarEvent are one thing to the coach. */
export async function DELETE(
  _req: Request,
  props: { params: Promise<{ id: string; competitionId: string }> }
) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const competition = await prisma.competition.findUnique({ where: { id: params.competitionId } });
  if (!competition || competition.coachId !== session.user.id || competition.athleteId !== params.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.$transaction([
    prisma.calendarEvent.deleteMany({ where: { competitionId: competition.id } }),
    prisma.competition.delete({ where: { id: competition.id } }),
  ]);

  track("competition_deleted", session.user.id, { competitionId: competition.id });

  return NextResponse.json({ ok: true });
}
