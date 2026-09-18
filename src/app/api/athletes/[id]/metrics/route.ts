import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createMetricValueSchema } from "@/lib/validation";
import { getSportMetrics } from "@/lib/sport";
import { track } from "@/lib/analytics";

const RECENT_VALUES_LIMIT = 30;

export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const athlete = await prisma.athlete.findUnique({ where: { id: params.id } });
  if (!athlete || athlete.coachId !== session.user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [metrics, values] = await Promise.all([
    getSportMetrics(athlete.sportId, session.user.id),
    prisma.athleteMetricValue.findMany({
      where: { athleteId: params.id },
      orderBy: { recordedAt: "desc" },
      take: RECENT_VALUES_LIMIT,
    }),
  ]);

  return NextResponse.json({ metrics, values });
}

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const athlete = await prisma.athlete.findUnique({ where: { id: params.id } });
  if (!athlete || athlete.coachId !== session.user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = createMetricValueSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dati non validi" }, { status: 400 });
  }

  // The metric must actually belong to this athlete's sport — otherwise a
  // coach could record a value against another sport's metric definition.
  const sportMetric = await prisma.sportMetric.findUnique({ where: { id: parsed.data.sportMetricId } });
  if (!sportMetric || sportMetric.sportId !== athlete.sportId) {
    return NextResponse.json({ error: "Metrica non valida per questo sport." }, { status: 400 });
  }

  const value = await prisma.athleteMetricValue.create({
    data: {
      athleteId: athlete.id,
      coachId: session.user.id,
      sportMetricId: sportMetric.id,
      value: parsed.data.value,
      recordedAt: parsed.data.recordedAt ? new Date(parsed.data.recordedAt) : undefined,
      notes: parsed.data.notes || undefined,
    },
  });

  track("metric_value_recorded", session.user.id, { athleteId: athlete.id, sportMetricId: sportMetric.id });

  return NextResponse.json({ value });
}
