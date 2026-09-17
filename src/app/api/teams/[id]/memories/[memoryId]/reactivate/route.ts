import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { reactivateTeamMemory } from "@/lib/memory";
import { track } from "@/lib/analytics";

/** Nothing here is irreversible — undoes a reject. */
export async function POST(req: Request, props: { params: Promise<{ id: string; memoryId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = await props.params;
  const team = await prisma.team.findUnique({ where: { id: params.id } });
  if (!team || team.coachId !== session.user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await reactivateTeamMemory(params.memoryId, session.user.id);
  track("team_memory_reactivated", session.user.id, { teamId: params.id, memoryId: params.memoryId });

  return NextResponse.json({ ok: true });
}
