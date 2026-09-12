import { prisma } from "@/lib/prisma";
import { track } from "@/lib/analytics";

export type FinalizeResult =
  | { ok: true; alreadyCompleted?: boolean }
  | { ok: false; reason: "not_found" | "already_failed" | "square_no_longer_available" };

/**
 * Settles a PENDING transaction: the single place where square ownership
 * actually changes hands. Called from both the Stripe webhook (real payments)
 * and the mock-confirm route (dev/test payments) — never duplicated, so the
 * two paths can never drift apart on what "a completed purchase" means.
 *
 * Idempotent: safe to call more than once for the same transaction (Stripe
 * webhooks can redeliver).
 */
export async function finalizePurchase(
  transactionId: string,
  opts: { stripePaymentIntentId?: string } = {}
): Promise<FinalizeResult> {
  return prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.findUnique({ where: { id: transactionId } });
    if (!transaction) return { ok: false, reason: "not_found" as const };
    if (transaction.status === "COMPLETED") return { ok: true, alreadyCompleted: true };
    if (transaction.status === "FAILED") return { ok: false, reason: "already_failed" as const };

    if (transaction.type === "PRIMARY") {
      // Conditional update guards against two buyers racing the same square:
      // only the first request whose WHERE clause still matches wins.
      const result = await tx.square.updateMany({
        where: { id: transaction.squareId, status: "AVAILABLE" },
        data: {
          status: "OWNED",
          ownerId: transaction.buyerId,
          purchasedAt: new Date(),
        },
      });

      if (result.count === 0) {
        await tx.transaction.update({ where: { id: transactionId }, data: { status: "FAILED" } });
        return { ok: false, reason: "square_no_longer_available" as const };
      }

      await tx.transaction.update({
        where: { id: transactionId },
        data: { status: "COMPLETED", stripePaymentIntentId: opts.stripePaymentIntentId },
      });

      await tx.chapter.update({
        where: { id: transaction.chapterId },
        data: { squaresSold: { increment: 1 }, totalTransactions: { increment: 1 } },
      });
    } else {
      // SECONDARY: square must still be LISTED with an active listing owned by the seller.
      const listing = await tx.listing.findFirst({
        where: { squareId: transaction.squareId, status: "ACTIVE" },
      });
      if (!listing) {
        await tx.transaction.update({ where: { id: transactionId }, data: { status: "FAILED" } });
        return { ok: false, reason: "square_no_longer_available" as const };
      }

      const result = await tx.square.updateMany({
        where: { id: transaction.squareId, status: "LISTED" },
        data: {
          status: "OWNED",
          ownerId: transaction.buyerId,
          purchasedAt: new Date(),
        },
      });

      if (result.count === 0) {
        await tx.transaction.update({ where: { id: transactionId }, data: { status: "FAILED" } });
        return { ok: false, reason: "square_no_longer_available" as const };
      }

      await tx.listing.update({ where: { id: listing.id }, data: { status: "SOLD" } });
      await tx.transaction.update({
        where: { id: transactionId },
        data: { status: "COMPLETED", stripePaymentIntentId: opts.stripePaymentIntentId },
      });
      await tx.chapter.update({
        where: { id: transaction.chapterId },
        data: { totalTransactions: { increment: 1 } },
      });
    }

    track(
      transaction.type === "PRIMARY" ? "square_purchase_completed" : "resale_completed",
      transaction.buyerId,
      { squareId: transaction.squareId, amount: transaction.amount }
    );

    return { ok: true };
  });
}
