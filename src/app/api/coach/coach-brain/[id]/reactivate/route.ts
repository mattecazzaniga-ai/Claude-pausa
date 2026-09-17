import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { reactivateCoachPreference } from "@/lib/intelligence/coach-brain";
import { track } from "@/lib/analytics";

/** Nothing here is irreversible — undoes a reject. */
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = await props.params;
  await reactivateCoachPreference(params.id, session.user.id);
  track("coach_preference_reactivated", session.user.id, { preferenceId: params.id });

  return NextResponse.json({ ok: true });
}
