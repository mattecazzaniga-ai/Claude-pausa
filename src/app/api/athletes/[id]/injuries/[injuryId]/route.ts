import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateInjurySchema } from "@/lib/validation";
import { track } from "@/lib/analytics";

async function loadOwnedInjury(athleteId: string, injuryId: string, coachId: string) {
  const injury = await prisma.athleteInjury.findUnique({ where: { id: injuryId } });
  if (!injury || injury.athleteId !== athleteId || injury.coachId !== coachId) return null;
  return injury;
}

export async function PATCH(req: Request, props: { params: Promise<{ id: string; injuryId: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await loadOwnedInjury(params.id, params.injuryId, session.user.id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = updateInjurySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dati non validi" }, { status: 400 });
  }

  const injury = await prisma.athleteInjury.update({
    where: { id: params.injuryId },
    data: {
      status: parsed.data.status ?? undefined,
      resolvedDate:
        parsed.data.resolvedDate !== undefined ? (parsed.data.resolvedDate ? new Date(parsed.data.resolvedDate) : null) : undefined,
      description: parsed.data.description !== undefined ? parsed.data.description || null : undefined,
      reportedLimitations: parsed.data.reportedLimitations !== undefined ? parsed.data.reportedLimitations || null : undefined,
      coachNotes: parsed.data.coachNotes !== undefined ? parsed.data.coachNotes || null : undefined,
    },
    include: { events: { orderBy: { date: "asc" } } },
  });

  track("injury_updated", session.user.id, { athleteId: params.id, injuryId: injury.id, status: injury.status });

  return NextResponse.json({ injury });
}

export async function DELETE(_req: Request, props: { params: Promise<{ id: string; injuryId: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await loadOwnedInjury(params.id, params.injuryId, session.user.id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.athleteInjuryEvent.deleteMany({ where: { injuryId: params.injuryId } });
  await prisma.athleteInjury.delete({ where: { id: params.injuryId } });

  track("injury_deleted", session.user.id, { athleteId: params.id, injuryId: params.injuryId });

  return NextResponse.json({ ok: true });
}
