import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { track } from "@/lib/analytics";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const trainingSession = await prisma.trainingSession.findUnique({
    where: { id: params.id },
    include: {
      athlete: { select: { id: true, name: true } },
      team: { select: { id: true, name: true } },
      blocks: {
        orderBy: { order: "asc" },
        include: { exercise: { include: { skills: { include: { skill: true } } } } },
      },
    },
  });

  if (!trainingSession || trainingSession.coachId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ session: trainingSession });
}

/** Any calendar event linked to this session survives, just detached — deleting the plan isn't deleting the scheduled slot. */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const trainingSession = await prisma.trainingSession.findUnique({ where: { id: params.id } });
  if (!trainingSession || trainingSession.coachId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.$transaction([
    prisma.sessionBlock.deleteMany({ where: { trainingSessionId: trainingSession.id } }),
    prisma.trainingSession.delete({ where: { id: trainingSession.id } }),
  ]);

  track("training_session_deleted", session.user.id, { sessionId: trainingSession.id });

  return NextResponse.json({ ok: true });
}
