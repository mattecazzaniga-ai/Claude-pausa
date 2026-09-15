import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSportProfile, regenerateSportProfile } from "@/lib/sport";
import { isAiConfigured } from "@/lib/ai";
import { rateLimit } from "@/lib/rate-limit";
import { track } from "@/lib/analytics";
import { captureError } from "@/lib/monitoring";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const coach = await prisma.coach.findUnique({ where: { id: session.user.id }, select: { primarySport: true } });
  if (!coach?.primarySport) return NextResponse.json({ error: "Nessuno sport selezionato." }, { status: 409 });

  const profile = await getSportProfile(coach.primarySport.id);
  return NextResponse.json({ sportName: coach.primarySport.name, profile });
}

/** Force-regenerates the shared Sport Profile — use when it looks wrong (e.g. terms borrowed from a similar sport). */
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isAiConfigured) {
    return NextResponse.json({ error: "L'AI non è configurata su questo ambiente." }, { status: 503 });
  }

  if (!rateLimit(`sport-profile-regen:${session.user.id}`, 5, 60 * 1000)) {
    return NextResponse.json({ error: "Troppe richieste, rallenta un attimo." }, { status: 429 });
  }

  const coach = await prisma.coach.findUnique({ where: { id: session.user.id }, select: { primarySport: true } });
  if (!coach?.primarySport) return NextResponse.json({ error: "Nessuno sport selezionato." }, { status: 409 });

  let profile;
  try {
    profile = await regenerateSportProfile(coach.primarySport.id);
  } catch (err) {
    captureError("Sport profile regeneration failed", err);
    return NextResponse.json({ error: "La rigenerazione AI non è riuscita. Riprova tra poco." }, { status: 502 });
  }

  track("sport_profile_regenerated", session.user.id, { sportId: coach.primarySport.id });

  return NextResponse.json({ sportName: coach.primarySport.name, profile });
}
