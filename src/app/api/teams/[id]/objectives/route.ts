import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createObjectiveSchema } from "@/lib/validation";
import { track } from "@/lib/analytics";

export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const team = await prisma.team.findUnique({ where: { id: params.id } });
  if (!team || team.coachId !== session.user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const objectives = await prisma.objective.findMany({
    where: { teamId: params.id },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });

  return NextResponse.json({ objectives });
}

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const team = await prisma.team.findUnique({ where: { id: params.id } });
  if (!team || team.coachId !== session.user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = createObjectiveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dati non validi" }, { status: 400 });
  }

  const objective = await prisma.objective.create({
    data: {
      coachId: session.user.id,
      teamId: team.id,
      title: parsed.data.title,
      description: parsed.data.description || undefined,
      termLength: parsed.data.termLength,
      kind: parsed.data.kind,
      baselineValue: parsed.data.baselineValue || undefined,
      targetValue: parsed.data.targetValue || undefined,
      currentValue: parsed.data.currentValue || parsed.data.baselineValue || undefined,
      unit: parsed.data.unit || undefined,
      deadline: parsed.data.deadline ? new Date(parsed.data.deadline) : undefined,
    },
  });

  track("objective_created", session.user.id, { teamId: team.id, objectiveId: objective.id });

  return NextResponse.json({ objective });
}
