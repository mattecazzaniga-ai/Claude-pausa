import { prisma } from "@/lib/prisma";

/**
 * Master prompt PART 1 §12,43: consumes exactly one credit from a purchase
 * when a calendar event is completed — idempotent (a calendar event can
 * only ever consume once, guarded by creditConsumedAt) and safe against a
 * purchase that's since become unusable (refunded, cancelled, expired, or
 * exhausted), which is silently skipped rather than wrongly deducted.
 */
export async function consumeCreditIfApplicable(eventId: string, purchaseId: string): Promise<void> {
  const purchase = await prisma.purchase.findUnique({ where: { id: purchaseId } });
  if (!purchase) return;
  if (purchase.status !== "ACTIVE") return;
  if (purchase.expiresAt && purchase.expiresAt.getTime() < Date.now()) return;
  if (purchase.sessionsPurchased != null && purchase.sessionsUsed >= purchase.sessionsPurchased) return;

  await prisma.$transaction(async (tx) => {
    // Only one concurrent request can win this guarded update — the second
    // matches zero rows and does nothing, which is what makes this safe
    // against double-consumption from a race (§43).
    const guarded = await tx.calendarEvent.updateMany({
      where: { id: eventId, creditConsumedAt: null },
      data: { creditConsumedAt: new Date() },
    });
    if (guarded.count === 0) return;

    await tx.purchase.update({ where: { id: purchaseId }, data: { sessionsUsed: { increment: 1 } } });
  });
}
