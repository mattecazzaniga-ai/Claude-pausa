import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createWeeklyPlanSchema } from "@/lib/validation";
import { isAiConfigured } from "@/lib/ai";
import { createTeamWeeklyPlan, getCurrentTeamWeeklyPlan } from "@/lib/weekly-plan";
import { rateLimit } from "@/lib/rate-limit";
import { track } from "@/lib/analytics";
import { captureError } from "@/lib/monitoring";

export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const team = await prisma.team.findUnique({ where: { id: params.id } });
  if (!team || team.coachId !== session.user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const plan = await getCurrentTeamWeeklyPlan(team.id);
  return NextResponse.json({ plan, trainingDaysPerWeek: team.trainingDaysPerWeek });
}

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isAiConfigured) return NextResponse.json({ error: "L'AI non è configurata su questo ambiente." }, { status: 503 });

  if (!rateLimit(`weekly-plan-gen:${session.user.id}`, 10, 60 * 1000)) {
    return NextResponse.json({ error: "Troppe richieste, rallenta un attimo." }, { status: 429 });
  }

  const team = await prisma.team.findUnique({ where: { id: params.id }, include: { members: true } });
  if (!team || team.coachId !== session.user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (team.members.length === 0) {
    return NextResponse.json({ error: "Aggiungi almeno un atleta alla squadra prima di generare un piano." }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createWeeklyPlanSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dati non validi" }, { status: 400 });
  }

  try {
    const plan = await createTeamWeeklyPlan(team.id, parsed.data.sessionsPerWeek);
    track("weekly_plan_generated", session.user.id, { teamId: team.id, sessionsPerWeek: parsed.data.sessionsPerWeek, phase: plan?.phase });
    return NextResponse.json({ plan });
  } catch (err) {
    captureError("Weekly plan generation failed", err);
    return NextResponse.json({ error: "La generazione AI non è riuscita. Riprova tra poco." }, { status: 502 });
  }
}
