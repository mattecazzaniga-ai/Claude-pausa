import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createCheckinSchema } from "@/lib/validation";
import { track } from "@/lib/analytics";

const RECENT_CHECKINS_LIMIT = 30;

export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const athlete = await prisma.athlete.findUnique({ where: { id: params.id } });
  if (!athlete || athlete.coachId !== session.user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const checkins = await prisma.athleteCheckin.findMany({
    where: { athleteId: params.id },
    orderBy: { date: "desc" },
    take: RECENT_CHECKINS_LIMIT,
  });

  return NextResponse.json({ checkins });
}

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const athlete = await prisma.athlete.findUnique({ where: { id: params.id } });
  if (!athlete || athlete.coachId !== session.user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = createCheckinSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dati non validi" }, { status: 400 });
  }

  const checkin = await prisma.athleteCheckin.create({
    data: {
      athleteId: athlete.id,
      coachId: session.user.id,
      readiness: parsed.data.readiness ?? undefined,
      rpe: parsed.data.rpe ?? undefined,
      feeling: parsed.data.feeling ?? undefined,
      sleepHours: parsed.data.sleepHours ?? undefined,
      soreness: parsed.data.soreness ?? undefined,
      notes: parsed.data.notes || undefined,
    },
  });

  track("checkin_created", session.user.id, { athleteId: athlete.id });

  return NextResponse.json({ checkin });
}
