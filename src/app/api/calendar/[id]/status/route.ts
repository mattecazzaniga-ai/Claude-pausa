import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calendarEventStatusSchema } from "@/lib/validation";
import { consumeCreditIfApplicable } from "@/lib/payments";
import { track } from "@/lib/analytics";

/**
 * Master prompt §12,38: "Mark Complete" (or cancel/no-show) on a calendar
 * event — independent of whether an AI session plan exists for it. This is
 * the one and only trigger for credit consumption (§20: never deduct a
 * credit merely because a calendar event exists).
 */
export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const event = await prisma.calendarEvent.findUnique({ where: { id: params.id } });
  if (!event || event.coachId !== session.user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (event.status !== "SCHEDULED") {
    return NextResponse.json({ error: "Questo evento ha già uno stato finale." }, { status: 409 });
  }

  const body = await req.json().catch(() => null);
  const parsed = calendarEventStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dati non validi" }, { status: 400 });
  }

  await prisma.calendarEvent.update({ where: { id: event.id }, data: { status: parsed.data.status } });

  // Cancelled sessions never consume a credit by default (§12). No-show is
  // the coach's call, made explicit via consumeCredit.
  const shouldConsume =
    event.purchaseId && (parsed.data.status === "COMPLETED" || (parsed.data.status === "NO_SHOW" && parsed.data.consumeCredit));
  if (shouldConsume && event.purchaseId) {
    await consumeCreditIfApplicable(event.id, event.purchaseId);
  }

  track("session_status_updated", session.user.id, { eventId: event.id, status: parsed.data.status });

  const updated = await prisma.calendarEvent.findUnique({
    where: { id: event.id },
    include: { purchase: { include: { offer: true } } },
  });

  return NextResponse.json({ event: updated });
}
