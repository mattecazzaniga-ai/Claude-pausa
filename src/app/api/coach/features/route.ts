import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { setInterestedFeaturesSchema } from "@/lib/validation";
import { track } from "@/lib/analytics";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = setInterestedFeaturesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dati non validi" }, { status: 400 });
  }

  await prisma.coach.update({
    where: { id: session.user.id },
    data: { interestedFeatures: parsed.data.features, featuresOnboardedAt: new Date() },
  });

  track("coach_features_onboarded", session.user.id, { count: parsed.data.features.length });

  return NextResponse.json({ ok: true });
}
