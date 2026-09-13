import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createSessionNoteSchema } from "@/lib/validation";
import { isAiConfigured, extractTagsFromNote, generateAthleteSummary } from "@/lib/ai";
import { getSportSkills, getSportProfile, formatSportProfileForPrompt } from "@/lib/sport";
import { rateLimit } from "@/lib/rate-limit";
import { track } from "@/lib/analytics";

const HISTORY_WINDOW = 8; // how many recent notes feed the summary — small on purpose, see lib/ai.ts

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!rateLimit(`note:${session.user.id}`, 30, 60 * 1000)) {
    return NextResponse.json({ error: "Troppe richieste, rallenta un attimo." }, { status: 429 });
  }

  const athlete = await prisma.athlete.findUnique({ where: { id: params.id }, include: { sport: true } });
  if (!athlete || athlete.coachId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createSessionNoteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dati non validi" }, { status: 400 });
  }

  const note = await prisma.sessionNote.create({
    data: {
      athleteId: athlete.id,
      coachId: session.user.id,
      rawText: parsed.data.rawText,
      sessionDate: parsed.data.sessionDate ? new Date(parsed.data.sessionDate) : new Date(),
    },
  });

  track("session_note_created", session.user.id, { athleteId: athlete.id });

  if (!isAiConfigured) {
    return NextResponse.json({ note, aiConfigured: false });
  }

  try {
    const skillOptions = await getSportSkills(athlete.sportId);
    const sportProfile = await getSportProfile(athlete.sportId);
    const sportContext = formatSportProfileForPrompt(athlete.sport.name, sportProfile);

    const extracted = await extractTagsFromNote(note.rawText, skillOptions, sportContext);
    if (extracted.length > 0) {
      await prisma.noteTag.createMany({
        data: extracted.map((t) => ({ sessionNoteId: note.id, skillId: t.skillId, sentiment: t.sentiment, excerpt: t.excerpt })),
      });
    }
    await prisma.sessionNote.update({ where: { id: note.id }, data: { aiProcessed: true } });

    const recentNotes = await prisma.sessionNote.findMany({
      where: { athleteId: athlete.id },
      orderBy: { sessionDate: "desc" },
      take: HISTORY_WINDOW,
      include: { tags: { include: { skill: { include: { category: true } } } } },
    });

    const summary = await generateAthleteSummary({
      athleteName: athlete.name,
      objectives: athlete.objectives,
      notes: recentNotes
        .slice()
        .reverse()
        .map((n) => ({
          sessionDate: n.sessionDate,
          rawText: n.rawText,
          tags: n.tags.map((t) => ({ sentiment: t.sentiment, skillName: t.skill.name, categoryName: t.skill.category.name })),
        })),
      sportContext,
    });

    await prisma.athlete.update({
      where: { id: athlete.id },
      data: { aiSummary: summary.summary, aiPriorities: summary.priorities, aiSummaryUpdatedAt: new Date() },
    });

    track("ai_extraction_completed", session.user.id, { athleteId: athlete.id, tagCount: extracted.length });

    const finalNote = await prisma.sessionNote.findUnique({
      where: { id: note.id },
      include: { tags: { include: { skill: true } } },
    });

    return NextResponse.json({ note: finalNote, aiConfigured: true, athleteSummary: summary });
  } catch (err) {
    console.error("AI processing failed for note", note.id, err);
    track("ai_extraction_failed", session.user.id, { athleteId: athlete.id, error: String(err) });
    // The note itself is already saved — AI enrichment failing shouldn't lose the coach's work.
    return NextResponse.json({ note, aiConfigured: true, aiError: "L'analisi AI non è riuscita, ma la nota è salvata." });
  }
}
