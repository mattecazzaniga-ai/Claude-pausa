import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateCalendarEventSchema } from "@/lib/validation";
import { track } from "@/lib/analytics";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const event = await prisma.calendarEvent.findUnique({ where: { id: params.id } });
  if (!event || event.coachId !== session.user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = updateCalendarEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dati non validi" }, { status: 400 });
  }

  const updated = await prisma.calendarEvent.update({
    where: { id: event.id },
    data: {
      title: parsed.data.title,
      startAt: parsed.data.startAt ? new Date(parsed.data.startAt) : undefined,
      endAt: parsed.data.endAt ? new Date(parsed.data.endAt) : undefined,
      location: parsed.data.location !== undefined ? parsed.data.location || null : undefined,
      notes: parsed.data.notes !== undefined ? parsed.data.notes || null : undefined,
      trainingSessionId: parsed.data.trainingSessionId,
    },
  });

  track("calendar_event_updated", session.user.id, { eventId: event.id });

  return NextResponse.json({ event: updated });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const event = await prisma.calendarEvent.findUnique({ where: { id: params.id } });
  if (!event || event.coachId !== session.user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // A COMPETITION event is tied 1:1 to its Competition record — deleting it
  // here would leave that Competition without a calendar entry, which is
  // confusing. Coaches remove those from the competition itself, not here.
  if (event.type === "COMPETITION") {
    return NextResponse.json({ error: "Rimuovi la competizione dalla scheda atleta/squadra per eliminare questo evento." }, { status: 409 });
  }

  await prisma.calendarEvent.delete({ where: { id: event.id } });

  track("calendar_event_deleted", session.user.id, { eventId: event.id });

  return NextResponse.json({ ok: true });
}
