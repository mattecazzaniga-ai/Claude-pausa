import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSportMetrics } from "@/lib/sport";
import { createSportMetricSchema } from "@/lib/validation";
import { track } from "@/lib/analytics";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const coach = await prisma.coach.findUnique({ where: { id: session.user.id }, select: { primarySportId: true } });
  if (!coach?.primarySportId) return NextResponse.json({ error: "Seleziona prima il tuo sport principale.", code: "SPORT_REQUIRED" }, { status: 409 });

  const metrics = await getSportMetrics(coach.primarySportId, session.user.id);
  return NextResponse.json({ metrics });
}

/** A coach can add their own metric on top of the sport's shared AI-generated set — e.g. a specific race distance like "Tempo sui 40km". */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const coach = await prisma.coach.findUnique({ where: { id: session.user.id }, select: { primarySportId: true } });
  if (!coach?.primarySportId) return NextResponse.json({ error: "Seleziona prima il tuo sport principale.", code: "SPORT_REQUIRED" }, { status: 409 });

  const body = await req.json().catch(() => null);
  const parsed = createSportMetricSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dati non validi" }, { status: 400 });
  }

  const maxOrder = await prisma.sportMetric.aggregate({
    where: { sportId: coach.primarySportId, coachId: session.user.id },
    _max: { order: true },
  });

  const metric = await prisma.sportMetric.create({
    data: {
      sportId: coach.primarySportId,
      coachId: session.user.id,
      name: parsed.data.name,
      unit: parsed.data.unit || undefined,
      description: parsed.data.description || undefined,
      direction: parsed.data.direction,
      order: (maxOrder._max.order ?? 0) + 1,
    },
  });

  track("sport_metric_created", session.user.id, { metricId: metric.id });

  return NextResponse.json({ metric });
}
