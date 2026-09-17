import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { confirmCoachPreference } from "@/lib/intelligence/coach-brain";
import { track } from "@/lib/analytics";

/** Master prompt §10: the only path to CONFIRMED — an explicit coach action, never inferred. */
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = await props.params;
  await confirmCoachPreference(params.id, session.user.id);
  track("coach_preference_confirmed", session.user.id, { preferenceId: params.id });

  return NextResponse.json({ ok: true });
}
