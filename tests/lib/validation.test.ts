import { describe, it, expect } from "vitest";
import {
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  createPurchaseSchema,
  createOfferSchema,
  createCalendarEventSchema,
} from "@/lib/validation";

describe("registerSchema", () => {
  it("accepts a valid registration and normalizes the email", () => {
    const result = registerSchema.safeParse({ name: "Marco Rossi", email: "  Marco@Example.COM ", password: "password123" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe("marco@example.com");
  });

  it("rejects a password shorter than 8 characters", () => {
    const result = registerSchema.safeParse({ name: "Marco Rossi", email: "marco@example.com", password: "short" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid email", () => {
    const result = registerSchema.safeParse({ name: "Marco Rossi", email: "not-an-email", password: "password123" });
    expect(result.success).toBe(false);
  });
});

describe("forgotPasswordSchema / resetPasswordSchema", () => {
  it("normalizes the email the same way as registration", () => {
    const result = forgotPasswordSchema.safeParse({ email: " Marco@Example.COM" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe("marco@example.com");
  });

  it("rejects an empty reset token", () => {
    const result = resetPasswordSchema.safeParse({ token: "", password: "password123" });
    expect(result.success).toBe(false);
  });

  it("rejects a new password shorter than 8 characters", () => {
    const result = resetPasswordSchema.safeParse({ token: "abc123", password: "short" });
    expect(result.success).toBe(false);
  });
});

describe("createPurchaseSchema", () => {
  it("accepts a valid online purchase", () => {
    const result = createPurchaseSchema.safeParse({ offerId: "offer_1", method: "ONLINE" });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown payment method", () => {
    const result = createPurchaseSchema.safeParse({ offerId: "offer_1", method: "BITCOIN" });
    expect(result.success).toBe(false);
  });
});

describe("createOfferSchema", () => {
  it("requires a billing frequency for subscriptions", () => {
    const result = createOfferSchema.safeParse({
      name: "Abbonamento mensile",
      type: "SUBSCRIPTION",
      priceCents: 5000,
      currency: "EUR",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a subscription once billingFrequency is set", () => {
    const result = createOfferSchema.safeParse({
      name: "Abbonamento mensile",
      type: "SUBSCRIPTION",
      priceCents: 5000,
      currency: "EUR",
      billingFrequency: "MONTHLY",
    });
    expect(result.success).toBe(true);
  });

  it("does not require billingFrequency for a single session", () => {
    const result = createOfferSchema.safeParse({
      name: "Sessione singola",
      type: "SINGLE_SESSION",
      priceCents: 3000,
      currency: "EUR",
    });
    expect(result.success).toBe(true);
  });
});

describe("createCalendarEventSchema", () => {
  it("rejects an event assigned to both an athlete and a team", () => {
    const result = createCalendarEventSchema.safeParse({
      type: "TRAINING",
      title: "Allenamento",
      startAt: new Date().toISOString(),
      endAt: new Date(Date.now() + 3600_000).toISOString(),
      athleteId: "athlete_1",
      teamId: "team_1",
    });
    expect(result.success).toBe(false);
  });

  it("accepts an event assigned to only an athlete", () => {
    const result = createCalendarEventSchema.safeParse({
      type: "TRAINING",
      title: "Allenamento",
      startAt: new Date().toISOString(),
      endAt: new Date(Date.now() + 3600_000).toISOString(),
      athleteId: "athlete_1",
    });
    expect(result.success).toBe(true);
  });
});
