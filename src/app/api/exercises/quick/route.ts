import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { quickCreateExerciseSchema } from "@/lib/validation";
import { parseExerciseFromText } from "@/lib/ai-exercise";
import { isAiConfigured } from "@/lib/ai";
import { getSportSkills } from "@/lib/sport";
import { rateLimit } from "@/lib/rate-limit";
import { track } from "@/lib/analytics";

/**
 * Parses a natural-language exercise description into a structured draft.
 * Does NOT save anything — the coach reviews/edits the draft in the UI, then
 * POSTs the final version to /api/exercises like any manually-created one.
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isAiConfigured) {
    return NextResponse.json({ error: "L'AI non è configurata su questo ambiente." }, { status: 503 });
  }

  if (!rateLimit(`exercise-quick:${session.user.id}`, 20, 60 * 1000)) {
    return NextResponse.json({ error: "Troppe richieste, rallenta un attimo." }, { status: 429 });
  }

  const coach = await prisma.coach.findUnique({ where: { id: session.user.id }, select: { primarySportId: true } });
  if (!coach?.primarySportId) {
    return NextResponse.json({ error: "Seleziona prima il tuo sport principale.", code: "SPORT_REQUIRED" }, { status: 409 });
  }

  const body = await req.json().catch(() => null);
  const parsed = quickCreateExerciseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dati non validi" }, { status: 400 });
  }

  const skills = await getSportSkills(coach.primarySportId);
  const draft = await parseExerciseFromText(parsed.data.description, skills);

  track("exercise_quick_created", session.user.id, {});

  return NextResponse.json({ draft, skills });
}
