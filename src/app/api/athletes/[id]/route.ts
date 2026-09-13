import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAthleteSchema } from "@/lib/validation";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const athlete = await prisma.athlete.findUnique({
    where: { id: params.id },
    include: {
      sport: { select: { name: true, slug: true } },
      sessionNotes: {
        orderBy: { sessionDate: "desc" },
        include: { tags: { include: { skill: { include: { category: true } } } } },
      },
    },
  });

  if (!athlete || athlete.coachId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ athlete });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const athlete = await prisma.athlete.findUnique({ where: { id: params.id } });
  if (!athlete || athlete.coachId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createAthleteSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dati non validi" }, { status: 400 });
  }

  const updated = await prisma.athlete.update({
    where: { id: params.id },
    data: {
      name: parsed.data.name ?? undefined,
      birthYear: parsed.data.birthYear ?? undefined,
      level: parsed.data.level ?? undefined,
      objectives: parsed.data.objectives ?? undefined,
    },
  });

  return NextResponse.json({ athlete: updated });
}
