import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { confirmAthleteMemory } from "@/lib/memory";
import { track } from "@/lib/analytics";

/** Master prompt §10: the only path to CONFIRMED — an explicit coach action, never inferred. */
export async function POST(req: Request, props: { params: Promise<{ id: string; memoryId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = await props.params;
  const athlete = await prisma.athlete.findUnique({ where: { id: params.id } });
  if (!athlete || athlete.coachId !== session.user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await confirmAthleteMemory(params.memoryId, session.user.id);
  track("athlete_memory_confirmed", session.user.id, { athleteId: params.id, memoryId: params.memoryId });

  return NextResponse.json({ ok: true });
}
