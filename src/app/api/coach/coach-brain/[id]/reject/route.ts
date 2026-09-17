import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { rejectCoachPreference } from "@/lib/intelligence/coach-brain";
import { track } from "@/lib/analytics";

/** Master prompt §24: keeps the row (never deletes) but excludes it from prompts and future resynthesis. */
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = await props.params;
  await rejectCoachPreference(params.id, session.user.id);
  track("coach_preference_rejected", session.user.id, { preferenceId: params.id });

  return NextResponse.json({ ok: true });
}
