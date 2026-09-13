import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addTeamMemberSchema } from "@/lib/validation";
import { track } from "@/lib/analytics";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const team = await prisma.team.findUnique({ where: { id: params.id } });
  if (!team || team.coachId !== session.user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = addTeamMemberSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dati non validi" }, { status: 400 });
  }

  const athlete = await prisma.athlete.findUnique({ where: { id: parsed.data.athleteId } });
  if (!athlete || athlete.coachId !== session.user.id || athlete.sportId !== team.sportId) {
    return NextResponse.json({ error: "Atleta non valido per questa squadra." }, { status: 400 });
  }

  await prisma.teamMember.upsert({
    where: { teamId_athleteId: { teamId: team.id, athleteId: athlete.id } },
    create: { teamId: team.id, athleteId: athlete.id },
    update: {},
  });

  track("team_member_added", session.user.id, { teamId: team.id, athleteId: athlete.id });

  return NextResponse.json({ ok: true });
}
