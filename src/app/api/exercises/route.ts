import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createExerciseSchema } from "@/lib/validation";
import { track } from "@/lib/analytics";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim();
  const category = url.searchParams.get("category");
  const difficulty = url.searchParams.get("difficulty");
  const skillId = url.searchParams.get("skillId");

  const exercises = await prisma.exercise.findMany({
    where: {
      coachId: session.user.id,
      ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
      ...(category ? { category: category as never } : {}),
      ...(difficulty ? { difficulty: difficulty as never } : {}),
      ...(skillId ? { skills: { some: { skillId } } } : {}),
    },
    include: { skills: { include: { skill: true } } },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({
    exercises: exercises.map((e) => ({
      id: e.id,
      name: e.name,
      description: e.description,
      category: e.category,
      format: e.format,
      difficulty: e.difficulty,
      durationMinutes: e.durationMinutes,
      equipment: e.equipment,
      tags: e.tags,
      source: e.source,
      skills: e.skills.map((s) => s.skill.name),
    })),
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const coach = await prisma.coach.findUnique({ where: { id: session.user.id }, select: { primarySportId: true } });
  if (!coach?.primarySportId) {
    return NextResponse.json({ error: "Seleziona prima il tuo sport principale.", code: "SPORT_REQUIRED" }, { status: 409 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createExerciseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dati non validi" }, { status: 400 });
  }

  const { skillIds, tags, ...data } = parsed.data;

  const exercise = await prisma.exercise.create({
    data: {
      ...data,
      coachId: session.user.id,
      sportId: coach.primarySportId,
      tags: tags ?? [],
      skills: skillIds?.length ? { create: skillIds.map((skillId) => ({ skillId })) } : undefined,
    },
    include: { skills: { include: { skill: true } } },
  });

  track("exercise_created", session.user.id, { exerciseId: exercise.id });

  return NextResponse.json({ exercise });
}
