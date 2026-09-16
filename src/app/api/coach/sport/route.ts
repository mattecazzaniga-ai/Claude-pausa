import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateSport } from "@/lib/sport";
import { track } from "@/lib/analytics";
import { z } from "zod";

const schema = z.union([
  z.object({ sportId: z.string().min(1) }),
  z.object({ customName: z.string().trim().min(2).max(60) }),
]);

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Seleziona uno sport valido." }, { status: 400 });
  }

  const sport =
    "sportId" in parsed.data
      ? await prisma.sport.findUnique({ where: { id: parsed.data.sportId } })
      : await getOrCreateSport(parsed.data.customName);

  if (!sport) return NextResponse.json({ error: "Sport non trovato." }, { status: 404 });

  const coach = await prisma.coach.update({
    where: { id: session.user.id },
    data: { primarySportId: sport.id },
    select: { name: true, selfCoaching: true },
  });

  // Self-coaching accounts train only themselves — provision their own
  // Athlete record once the sport is known, instead of asking them to create
  // "an athlete" for themselves in the normal multi-athlete flow.
  if (coach.selfCoaching) {
    const existingSelf = await prisma.athlete.findFirst({ where: { coachId: session.user.id, isSelf: true } });
    if (!existingSelf) {
      await prisma.athlete.create({
        data: { coachId: session.user.id, sportId: sport.id, name: coach.name, isSelf: true },
      });
    }
  }

  track("sport_onboarded", session.user.id, { sportId: sport.id, sportName: sport.name });

  return NextResponse.json({ sport });
}
