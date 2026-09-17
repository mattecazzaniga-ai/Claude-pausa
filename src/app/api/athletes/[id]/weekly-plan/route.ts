import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createWeeklyPlanSchema } from "@/lib/validation";
import { isAiConfigured } from "@/lib/ai";
import { createAthleteWeeklyPlan, getCurrentAthleteWeeklyPlan } from "@/lib/weekly-plan";
import { rateLimit } from "@/lib/rate-limit";
import { track } from "@/lib/analytics";
import { captureError } from "@/lib/monitoring";

export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const athlete = await prisma.athlete.findUnique({ where: { id: params.id } });
  if (!athlete || athlete.coachId !== session.user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const plan = await getCurrentAthleteWeeklyPlan(athlete.id);
  return NextResponse.json({ plan, trainingDaysPerWeek: athlete.trainingDaysPerWeek });
}

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isAiConfigured) return NextResponse.json({ error: "L'AI non è configurata su questo ambiente." }, { status: 503 });

  if (!rateLimit(`weekly-plan-gen:${session.user.id}`, 10, 60 * 1000)) {
    return NextResponse.json({ error: "Troppe richieste, rallenta un attimo." }, { status: 429 });
  }

  const athlete = await prisma.athlete.findUnique({ where: { id: params.id } });
  if (!athlete || athlete.coachId !== session.user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = createWeeklyPlanSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dati non validi" }, { status: 400 });
  }

  try {
    const plan = await createAthleteWeeklyPlan(athlete.id, parsed.data.sessionsPerWeek);
    track("weekly_plan_generated", session.user.id, { athleteId: athlete.id, sessionsPerWeek: parsed.data.sessionsPerWeek, phase: plan?.phase });
    return NextResponse.json({ plan });
  } catch (err) {
    captureError("Weekly plan generation failed", err);
    return NextResponse.json({ error: "La generazione AI non è riuscita. Riprova tra poco." }, { status: 502 });
  }
}
