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

  await prisma.coach.update({ where: { id: session.user.id }, data: { primarySportId: sport.id } });

  track("sport_onboarded", session.user.id, { sportId: sport.id, sportName: sport.name });

  return NextResponse.json({ sport });
}
