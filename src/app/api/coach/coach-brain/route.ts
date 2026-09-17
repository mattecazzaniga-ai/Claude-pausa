import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { refreshCoachBrainIfStale, getCoachLearnedPreferences } from "@/lib/intelligence/coach-brain";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await refreshCoachBrainIfStale(session.user.id);
  const preferences = await getCoachLearnedPreferences(session.user.id);

  return NextResponse.json({ preferences });
}
