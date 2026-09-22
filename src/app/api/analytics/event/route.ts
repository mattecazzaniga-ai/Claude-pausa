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
  "competition_prepared",
  "calendar_event_created",
  "calendar_event_updated",
  "calendar_event_deleted",
  "calendar_session_generated",
  "evaluation_criteria_imported",
  "evaluation_criteria_bulk_saved",
  "session_feedback_recorded",
  "training_mode_started",
  "next_action_generated",
  "recommendation_feedback_recorded",
  "bottleneck_diagnosed",
  "offer_created",
  "offer_updated",
  "purchase_created",
  "payment_status_updated",
  "checkout_session_created",
  "stripe_webhook_processed",
  "session_status_updated",
  "athlete_deleted",
  "team_deleted",
  "objective_deleted",
  "evaluation_deleted",
  "competition_deleted",
  "training_session_deleted",
  "exercise_deleted",
  "athlete_chat_question_asked",
  "checkin_created",
  "metric_value_recorded",
  "injury_recorded",
  "injury_updated",
  "injury_deleted",
  "injury_event_added",
  "methodology_saved",
  "methodology_imported",
  "performance_level_assessed",
  "main_gap_computed",
  "weekly_plan_generated",
  "weekly_plan_slot_filled",
  "coach_preference_confirmed",
  "coach_preference_rejected",
  "coach_preference_reactivated",
  "athlete_memory_confirmed",
  "athlete_memory_rejected",
  "athlete_memory_reactivated",
  "team_memory_confirmed",
  "team_memory_rejected",
  "team_memory_reactivated",
  "sport_metric_created",
  "command_bar_used",
  "training_load_recorded",
  "training_load_deleted",
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
