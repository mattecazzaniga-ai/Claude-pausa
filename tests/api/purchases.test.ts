import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { createTestCoach, createTestSport, createTestAthlete, createTestOffer, deleteTestCoach, deleteTestSport } from "../helpers/db";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/stripe", () => ({
  isStripeConfigured: true,
  createCheckoutSessionForPurchase: vi.fn(),
}));

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/athletes/test/purchases", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/athletes/[id]/purchases", () => {
  let coachId: string;
  let sportId: string;
  let athleteId: string;
  let offerId: string;

  beforeEach(async () => {
    const coach = await createTestCoach();
    coachId = coach.id;
    const sport = await createTestSport();
    sportId = sport.id;
    const athlete = await createTestAthlete(coachId, sportId);
    athleteId = athlete.id;
    const offer = await createTestOffer(coachId);
    offerId = offer.id;

    const { getServerSession } = await import("next-auth");
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: coachId, name: "Test Coach", email: coach.email } } as never);
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await deleteTestCoach(coachId);
    await deleteTestSport(sportId);
  });

  it("rolls back the Purchase/Payment rows when Stripe checkout-session creation fails", async () => {
    const { createCheckoutSessionForPurchase } = await import("@/lib/stripe");
    vi.mocked(createCheckoutSessionForPurchase).mockRejectedValue(new Error("Stripe is down"));

    const { POST } = await import("@/app/api/athletes/[id]/purchases/route");
    const res = await POST(jsonRequest({ offerId, method: "ONLINE" }), { params: { id: athleteId } });

    expect(res.status).toBe(502);

    // No phantom "pending forever" row should survive a failed checkout-session creation.
    const purchases = await prisma.purchase.findMany({ where: { athleteId, offerId } });
    expect(purchases).toHaveLength(0);
    const payments = await prisma.payment.findMany({ where: { purchase: { athleteId, offerId } } });
    expect(payments).toHaveLength(0);
  });

  it("keeps the Purchase/Payment rows and returns the checkout URL when Stripe succeeds", async () => {
    const { createCheckoutSessionForPurchase } = await import("@/lib/stripe");
    vi.mocked(createCheckoutSessionForPurchase).mockResolvedValue({ url: "https://checkout.stripe.com/test-session" });

    const { POST } = await import("@/app/api/athletes/[id]/purchases/route");
    const res = await POST(jsonRequest({ offerId, method: "ONLINE" }), { params: { id: athleteId } });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.checkoutUrl).toBe("https://checkout.stripe.com/test-session");

    const purchases = await prisma.purchase.findMany({ where: { athleteId, offerId } });
    expect(purchases).toHaveLength(1);
    expect(purchases[0].status).toBe("PENDING");
  });

  it("marks an offline purchase paid immediately when markPaidNow is set", async () => {
    const { POST } = await import("@/app/api/athletes/[id]/purchases/route");
    const res = await POST(jsonRequest({ offerId, method: "OFFLINE_CASH", markPaidNow: true }), { params: { id: athleteId } });

    expect(res.status).toBe(200);
    const purchases = await prisma.purchase.findMany({ where: { athleteId, offerId }, include: { payments: true } });
    expect(purchases).toHaveLength(1);
    expect(purchases[0].status).toBe("ACTIVE");
    expect(purchases[0].payments[0].status).toBe("PAID");
  });

  it("rejects a purchase for an offer that belongs to a different coach", async () => {
    const otherCoach = await createTestCoach();
    try {
      const otherOffer = await createTestOffer(otherCoach.id);

      const { POST } = await import("@/app/api/athletes/[id]/purchases/route");
      const res = await POST(jsonRequest({ offerId: otherOffer.id, method: "OFFLINE_CASH" }), { params: { id: athleteId } });

      expect(res.status).toBe(404);
    } finally {
      await deleteTestCoach(otherCoach.id);
    }
  });
});
