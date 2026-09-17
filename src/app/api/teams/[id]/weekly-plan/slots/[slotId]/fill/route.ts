import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fillPlanSlotSchema } from "@/lib/validation";
import { isAiConfigured } from "@/lib/ai";
import { fillTeamPlanSlot } from "@/lib/weekly-plan";
import { rateLimit } from "@/lib/rate-limit";
import { track } from "@/lib/analytics";
import { captureError } from "@/lib/monitoring";

export async function POST(req: Request, props: { params: Promise<{ id: string; slotId: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isAiConfigured) return NextResponse.json({ error: "L'AI non è configurata su questo ambiente." }, { status: 503 });

  if (!rateLimit(`team-session-gen:${session.user.id}`, 15, 60 * 1000)) {
    return NextResponse.json({ error: "Troppe richieste, rallenta un attimo." }, { status: 429 });
  }

  const team = await prisma.team.findUnique({ where: { id: params.id } });
  if (!team || team.coachId !== session.user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = fillPlanSlotSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dati non validi" }, { status: 400 });
  }

  try {
    const sessionId = await fillTeamPlanSlot(params.slotId, session.user.id, parsed.data.durationMinutes);
    track("weekly_plan_slot_filled", session.user.id, { teamId: team.id, sessionId });
    return NextResponse.json({ sessionId });
  } catch (err) {
    if (err instanceof Error && err.message === "Slot not found") return NextResponse.json({ error: "Slot non trovato." }, { status: 404 });
    if (err instanceof Error && err.message.includes("già una sessione")) return NextResponse.json({ error: err.message }, { status: 409 });
    captureError("Weekly plan slot fill failed", err);
    return NextResponse.json({ error: "La generazione AI non è riuscita. Riprova tra poco." }, { status: 502 });
  }
}
