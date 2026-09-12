import Stripe from "stripe";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

/** Real Stripe payments are only wired up once STRIPE_SECRET_KEY is configured. */
export const isStripeConfigured = Boolean(stripeSecretKey);

export const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

export type CheckoutMetadata = {
  transactionId: string;
  squareId: string;
};

export type CheckoutSession = {
  url: string;
  sessionId: string;
};

/**
 * Creates a checkout session for a pending Transaction. When Stripe keys are
 * configured, this is a real Stripe Checkout Session — the webhook at
 * /api/webhooks/stripe finalizes the purchase on `checkout.session.completed`.
 *
 * When no Stripe keys are configured (local dev / no credentials yet), this
 * falls back to an internal mock checkout page. Both paths call the exact
 * same `finalizePurchase` function to settle the transaction — the mock path
 * never shortcuts production logic, it only substitutes where the redirect
 * sends the buyer.
 */
export async function createCheckoutSession(params: {
  transactionId: string;
  squareId: number;
  amountEUR: number;
  description: string;
  successPath: string;
  cancelPath: string;
}): Promise<CheckoutSession> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  if (stripe) {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "eur",
            unit_amount: Math.round(params.amountEUR * 100),
            product_data: { name: params.description },
          },
          quantity: 1,
        },
      ],
      metadata: {
        transactionId: params.transactionId,
        squareId: String(params.squareId),
      },
      success_url: `${appUrl}${params.successPath}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}${params.cancelPath}`,
    });

    return { url: session.url!, sessionId: session.id };
  }

  // Mock mode: no real charge happens. The mock session id is stored on the
  // transaction and the mock-confirm route re-checks isStripeConfigured
  // before it will ever finalize anything.
  const mockSessionId = `mock_${params.transactionId}`;
  return {
    url: `${appUrl}/checkout/mock/${params.transactionId}`,
    sessionId: mockSessionId,
  };
}
