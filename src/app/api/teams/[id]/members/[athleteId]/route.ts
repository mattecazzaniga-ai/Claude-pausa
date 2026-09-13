import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { track } from "@/lib/analytics";

export async function DELETE(_req: Request, { params }: { params: { id: string; athleteId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const team = await prisma.team.findUnique({ where: { id: params.id } });
  if (!team || team.coachId !== session.user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.teamMember.deleteMany({ where: { teamId: team.id, athleteId: params.athleteId } });

  track("team_member_removed", session.user.id, { teamId: team.id, athleteId: params.athleteId });

  return NextResponse.json({ ok: true });
}
