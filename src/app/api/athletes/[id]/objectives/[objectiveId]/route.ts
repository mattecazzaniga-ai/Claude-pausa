import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateObjectiveSchema } from "@/lib/validation";
import { track } from "@/lib/analytics";

export async function PATCH(
  req: Request,
  props: { params: Promise<{ id: string; objectiveId: string }> }
) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const objective = await prisma.objective.findUnique({ where: { id: params.objectiveId } });
  if (!objective || objective.coachId !== session.user.id || objective.athleteId !== params.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = updateObjectiveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dati non validi" }, { status: 400 });
  }

  const updated = await prisma.objective.update({
    where: { id: objective.id },
    data: {
      currentValue: parsed.data.currentValue !== undefined ? parsed.data.currentValue || null : undefined,
      status: parsed.data.status,
    },
  });

  track("objective_updated", session.user.id, { objectiveId: objective.id, status: updated.status });

  return NextResponse.json({ objective: updated });
}

export async function DELETE(
  _req: Request,
  props: { params: Promise<{ id: string; objectiveId: string }> }
) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const objective = await prisma.objective.findUnique({ where: { id: params.objectiveId } });
  if (!objective || objective.coachId !== session.user.id || objective.athleteId !== params.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.objective.delete({ where: { id: objective.id } });

  track("objective_deleted", session.user.id, { objectiveId: objective.id });

  return NextResponse.json({ ok: true });
}
