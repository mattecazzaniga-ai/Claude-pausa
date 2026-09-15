import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAiConfigured } from "@/lib/ai";
import { buildAthleteIntelligenceContext } from "@/lib/intelligence/context";
import { diagnoseBottleneck } from "@/lib/intelligence/bottleneck";
import { rateLimit } from "@/lib/rate-limit";
import { track } from "@/lib/analytics";
import { captureError } from "@/lib/monitoring";

/** Master prompt §9 — ephemeral by design: a hypothesis to discuss now, not a record to keep. */
export async function POST(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isAiConfigured) return NextResponse.json({ error: "L'AI non è configurata su questo ambiente." }, { status: 503 });

  if (!rateLimit(`diagnose:${session.user.id}`, 15, 60 * 1000)) {
    return NextResponse.json({ error: "Troppe richieste, rallenta un attimo." }, { status: 429 });
  }

  const athlete = await prisma.athlete.findUnique({ where: { id: params.id } });
  if (!athlete || athlete.coachId !== session.user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const context = await buildAthleteIntelligenceContext(athlete.id);
    const diagnosis = await diagnoseBottleneck(context);

    track("bottleneck_diagnosed", session.user.id, { athleteId: athlete.id, hasEnoughData: diagnosis.hasEnoughData });

    return NextResponse.json({ diagnosis });
  } catch (err) {
    captureError("Bottleneck diagnosis failed", err);
    return NextResponse.json({ error: "La generazione AI non è riuscita. Riprova tra poco." }, { status: 502 });
  }
}
