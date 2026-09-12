import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export type AnalyticsEventName =
  | "landing_page_view"
  | "wall_open"
  | "square_view"
  | "square_purchase_started"
  | "square_purchase_completed"
  | "square_customized"
  | "listing_created"
  | "resale_started"
  | "resale_completed"
  | "signup";

/**
 * Fire-and-forget server-side event log. Never throws into the caller —
 * analytics must not be able to break a purchase or signup flow.
 */
export function track(name: AnalyticsEventName, userId?: string | null, metadata?: Record<string, unknown>) {
  prisma.analyticsEvent
    .create({ data: { name, userId: userId ?? null, metadata: (metadata as Prisma.InputJsonValue) ?? undefined } })
    .catch((err) => console.error("analytics track failed", name, err));
}
