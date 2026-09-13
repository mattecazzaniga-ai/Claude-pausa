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
  | "session_block_regenerated";

/**
 * Fire-and-forget server-side event log. Never throws into the caller —
 * analytics must not be able to break the coaching workflow.
 */
export function track(name: AnalyticsEventName, coachId?: string | null, metadata?: Record<string, unknown>) {
  prisma.analyticsEvent
    .create({ data: { name, coachId: coachId ?? null, metadata: (metadata as Prisma.InputJsonValue) ?? undefined } })
    .catch((err) => console.error("analytics track failed", name, err));
}
