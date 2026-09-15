import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { track } from "@/lib/analytics";

export async function DELETE(
  _req: Request,
  props: { params: Promise<{ id: string; evaluationId: string }> }
) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const evaluation = await prisma.evaluation.findUnique({ where: { id: params.evaluationId } });
  if (!evaluation || evaluation.coachId !== session.user.id || evaluation.athleteId !== params.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.$transaction([
    prisma.evaluationScore.deleteMany({ where: { evaluationId: evaluation.id } }),
    prisma.evaluation.delete({ where: { id: evaluation.id } }),
  ]);

  track("evaluation_deleted", session.user.id, { evaluationId: evaluation.id });

  return NextResponse.json({ ok: true });
}
