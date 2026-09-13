import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { track, type AnalyticsEventName } from "@/lib/analytics";

const ALLOWED: AnalyticsEventName[] = [
  "signup",
  "athlete_created",
  "session_note_created",
  "ai_extraction_completed",
  "ai_extraction_failed",
  "athlete_summary_viewed",
  "exercise_created",
  "exercise_quick_created",
  "training_session_generated",
  "session_block_replaced",
  "session_block_regenerated",
  "team_created",
  "team_member_added",
  "team_member_removed",
  "team_session_generated",
  "sport_profile_regenerated",
  "objective_created",
  "objective_updated",
  "evaluation_created",
  "evaluation_criterion_created",
  "competition_created",
  "competition_result_recorded",
  "calendar_event_created",
  "calendar_event_updated",
  "calendar_event_deleted",
  "calendar_session_generated",
];

/** Thin endpoint for client-side analytics beacons (server-side flows call track() directly). */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const body = await req.json().catch(() => null);
  const name = body?.name as AnalyticsEventName | undefined;
  if (!name || !ALLOWED.includes(name)) return NextResponse.json({ ok: false }, { status: 400 });

  track(name, session?.user?.id, body?.metadata);
  return NextResponse.json({ ok: true });
}
