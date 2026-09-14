import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createExerciseSchema } from "@/lib/validation";
import { track } from "@/lib/analytics";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const exercise = await prisma.exercise.findUnique({
    where: { id: params.id },
    include: { skills: { include: { skill: true } } },
  });
  if (!exercise || exercise.coachId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ exercise });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const exercise = await prisma.exercise.findUnique({ where: { id: params.id } });
  if (!exercise || exercise.coachId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createExerciseSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dati non validi" }, { status: 400 });
  }

  const { skillIds, tags, ...data } = parsed.data;

  const updated = await prisma.exercise.update({
    where: { id: params.id },
    data: {
      ...data,
      tags: tags ?? undefined,
      ...(skillIds
        ? { skills: { deleteMany: {}, create: skillIds.map((skillId) => ({ skillId })) } }
        : {}),
    },
    include: { skills: { include: { skill: true } } },
  });

  return NextResponse.json({ exercise: updated });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const exercise = await prisma.exercise.findUnique({ where: { id: params.id } });
  if (!exercise || exercise.coachId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.exerciseSkill.deleteMany({ where: { exerciseId: params.id } });
  // Session blocks that reference this exercise keep the historical record but lose the live link.
  await prisma.sessionBlock.updateMany({ where: { exerciseId: params.id }, data: { exerciseId: null } });
  await prisma.exercise.delete({ where: { id: params.id } });

  track("exercise_deleted", session.user.id, { exerciseId: params.id });

  return NextResponse.json({ ok: true });
}
