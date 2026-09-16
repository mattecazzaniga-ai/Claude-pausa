import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export type AnalyticsEventName =
  | "signup"
  | "sport_onboarded"
  | "athlete_created"
  | "session_note_created"
  | "ai_extraction_completed"
  | "ai_extraction_failed"
  | "athlete_summary_viewed"
  | "exercise_created"
  | "exercise_quick_created"
  | "training_session_generated"
  | "session_block_replaced"
  | "session_block_regenerated"
  | "team_created"
  | "team_member_added"
  | "team_member_removed"
  | "team_session_generated"
  | "sport_profile_regenerated"
  | "objective_created"
  | "objective_updated"
  | "evaluation_created"
  | "evaluation_criterion_created"
  | "competition_created"
  | "competition_result_recorded"
  | "competition_prepared"
  | "calendar_event_created"
  | "calendar_event_updated"
  | "calendar_event_deleted"
  | "calendar_session_generated"
  | "evaluation_criteria_imported"
  | "evaluation_criteria_bulk_saved"
  | "session_feedback_recorded"
  | "training_mode_started"
  | "next_action_generated"
  | "recommendation_feedback_recorded"
  | "bottleneck_diagnosed"
  | "offer_created"
  | "offer_updated"
  | "purchase_created"
  | "payment_status_updated"
  | "checkout_session_created"
  | "stripe_webhook_processed"
  | "session_status_updated"
  | "athlete_deleted"
  | "team_deleted"
  | "objective_deleted"
  | "evaluation_deleted"
  | "competition_deleted"
  | "training_session_deleted"
  | "exercise_deleted"
  | "password_reset_requested"
  | "password_reset_completed"
  | "athlete_chat_question_asked"
  | "checkin_created";

/**
 * Fire-and-forget server-side event log. Never throws into the caller —
 * analytics must not be able to break the coaching workflow.
 */
export function track(name: AnalyticsEventName, coachId?: string | null, metadata?: Record<string, unknown>) {
  prisma.analyticsEvent
    .create({ data: { name, coachId: coachId ?? null, metadata: (metadata as Prisma.InputJsonValue) ?? undefined } })
    .catch((err) => console.error("analytics track failed", name, err));
}
