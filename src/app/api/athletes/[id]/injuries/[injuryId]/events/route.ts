import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createInjuryEventSchema } from "@/lib/validation";
import { track } from "@/lib/analytics";

export async function POST(req: Request, props: { params: Promise<{ id: string; injuryId: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const injury = await prisma.athleteInjury.findUnique({ where: { id: params.injuryId } });
  if (!injury || injury.athleteId !== params.id || injury.coachId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createInjuryEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dati non validi" }, { status: 400 });
  }

  const event = await prisma.athleteInjuryEvent.create({
    data: {
      injuryId: injury.id,
      note: parsed.data.note,
      date: parsed.data.date ? new Date(parsed.data.date) : undefined,
    },
  });

  track("injury_event_added", session.user.id, { athleteId: params.id, injuryId: injury.id });

  return NextResponse.json({ event });
}
