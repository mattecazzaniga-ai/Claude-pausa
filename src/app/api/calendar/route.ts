import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createCalendarEventSchema } from "@/lib/validation";
import { track } from "@/lib/analytics";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (!from || !to) return NextResponse.json({ error: "Parametri from/to mancanti." }, { status: 400 });

  const events = await prisma.calendarEvent.findMany({
    where: { coachId: session.user.id, startAt: { gte: new Date(from) }, endAt: { lte: new Date(to) } },
    include: {
      athlete: { select: { id: true, name: true } },
      team: { select: { id: true, name: true } },
      competition: { select: { id: true, type: true, result: true } },
    },
    orderBy: { startAt: "asc" },
  });

  return NextResponse.json({ events });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = createCalendarEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dati non validi" }, { status: 400 });
  }

  if (parsed.data.athleteId) {
    const athlete = await prisma.athlete.findUnique({ where: { id: parsed.data.athleteId } });
    if (!athlete || athlete.coachId !== session.user.id) return NextResponse.json({ error: "Atleta non valido." }, { status: 400 });
  }
  if (parsed.data.teamId) {
    const team = await prisma.team.findUnique({ where: { id: parsed.data.teamId } });
    if (!team || team.coachId !== session.user.id) return NextResponse.json({ error: "Squadra non valida." }, { status: 400 });
  }

  const event = await prisma.calendarEvent.create({
    data: {
      coachId: session.user.id,
      type: parsed.data.type,
      title: parsed.data.title,
      startAt: new Date(parsed.data.startAt),
      endAt: new Date(parsed.data.endAt),
      athleteId: parsed.data.athleteId || undefined,
      teamId: parsed.data.teamId || undefined,
      location: parsed.data.location || undefined,
      notes: parsed.data.notes || undefined,
    },
  });

  track("calendar_event_created", session.user.id, { eventId: event.id, type: event.type });

  return NextResponse.json({ event });
}
