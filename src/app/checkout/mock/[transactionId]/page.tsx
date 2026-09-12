import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isStripeConfigured } from "@/lib/payments";
import { idToCoords } from "@/lib/grid";
import { MockCheckoutClient } from "./mock-checkout-client";

export default async function MockCheckoutPage({ params }: { params: { transactionId: string } }) {
  if (isStripeConfigured) redirect("/wall");

  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const transaction = await prisma.transaction.findUnique({ where: { id: params.transactionId } });
  if (!transaction || transaction.buyerId !== session.user.id) redirect("/wall");

  if (transaction.status !== "PENDING") {
    redirect(`/square/${transaction.squareId}`);
  }

  const { x, y } = idToCoords(transaction.squareId);

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm animate-fade-in rounded-xl border border-border bg-surface p-6">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-gold">Test mode</span>
          <span className="rounded bg-surface-2 px-2 py-1 text-[10px] text-muted">No real card is charged</span>
        </div>

        <h1 className="text-lg font-semibold">Simulated checkout</h1>
        <p className="mt-1 text-sm text-muted">
          Stripe isn&apos;t configured on this deployment, so purchases run through this safe test flow instead. Real
          Stripe Checkout will replace this page automatically once API keys are set.
        </p>

        <div className="my-5 rounded-lg border border-border bg-surface-2 p-4 text-sm">
          <div className="flex justify-between py-1">
            <span className="text-muted">Square</span>
            <span>
              #{transaction.squareId} ({x}, {y})
            </span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-muted">Amount</span>
            <span className="font-medium">€{transaction.amount.toFixed(2)}</span>
          </div>
        </div>

        <MockCheckoutClient transactionId={transaction.id} squareId={transaction.squareId} />
      </div>
    </main>
  );
}
