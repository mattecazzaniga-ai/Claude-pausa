import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { track } from "@/lib/analytics";

export async function DELETE(_req: Request, props: { params: Promise<{ id: string; entryId: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const entry = await prisma.trainingLoadEntry.findUnique({ where: { id: params.entryId } });
  if (!entry || entry.athleteId !== params.id || entry.coachId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.trainingLoadEntry.delete({ where: { id: params.entryId } });

  track("training_load_deleted", session.user.id, { athleteId: params.id, entryId: params.entryId });

  return NextResponse.json({ ok: true });
}
