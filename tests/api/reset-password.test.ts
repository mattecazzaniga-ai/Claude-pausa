import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createTestCoach, deleteTestCoach } from "../helpers/db";

vi.mock("@/lib/email", () => ({
  isEmailConfigured: true,
  sendPasswordResetEmail: vi.fn(),
}));

// Rate limiting has its own dedicated unit test — here it would just make
// tests flaky, since every request in this file shares the same "unknown"
// client IP bucket.
vi.mock("@/lib/rate-limit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rate-limit")>();
  return { ...actual, rateLimit: () => true };
});

function forgotRequest(email: string) {
  return new Request("http://localhost/api/auth/forgot-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
}

function resetRequest(token: string, password: string) {
  return new Request("http://localhost/api/auth/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, password }),
  });
}

describe("password reset flow", () => {
  let coachId: string;
  let coachEmail: string;

  beforeEach(async () => {
    const coach = await createTestCoach();
    coachId = coach.id;
    coachEmail = coach.email;
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await deleteTestCoach(coachId);
  });

  it("creates a single-use token and emails it, without ever exposing whether the account exists", async () => {
    const { sendPasswordResetEmail } = await import("@/lib/email");
    const { POST: forgotPassword } = await import("@/app/api/auth/forgot-password/route");

    const resKnown = await forgotPassword(forgotRequest(coachEmail));
    expect(resKnown.status).toBe(200);
    expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1);

    const resUnknown = await forgotPassword(forgotRequest("nobody-with-this-email@example.test"));
    expect(resUnknown.status).toBe(200);
    // Same 200 for an unregistered email, and no second token/email generated for it.
    expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1);

    const tokens = await prisma.passwordResetToken.findMany({ where: { coachId } });
    expect(tokens).toHaveLength(1);
    expect(tokens[0].usedAt).toBeNull();
  });

  it("lets a valid token set a new password exactly once", async () => {
    const { sendPasswordResetEmail } = await import("@/lib/email");
    const { POST: forgotPassword } = await import("@/app/api/auth/forgot-password/route");
    const { POST: resetPassword } = await import("@/app/api/auth/reset-password/route");

    await forgotPassword(forgotRequest(coachEmail));
    const rawToken = vi.mocked(sendPasswordResetEmail).mock.calls[0][1];

    const res = await resetPassword(resetRequest(rawToken, "brandNewPassword123"));
    expect(res.status).toBe(200);

    const coach = await prisma.coach.findUniqueOrThrow({ where: { id: coachId } });
    expect(await bcrypt.compare("brandNewPassword123", coach.passwordHash)).toBe(true);

    const token = await prisma.passwordResetToken.findFirstOrThrow({ where: { coachId } });
    expect(token.usedAt).not.toBeNull();

    // Reusing the same (now-consumed) token must fail.
    const reuse = await resetPassword(resetRequest(rawToken, "anotherPassword456"));
    expect(reuse.status).toBe(400);
  });

  it("invalidates other outstanding tokens once one of them is used", async () => {
    const { sendPasswordResetEmail } = await import("@/lib/email");
    const { POST: forgotPassword } = await import("@/app/api/auth/forgot-password/route");
    const { POST: resetPassword } = await import("@/app/api/auth/reset-password/route");

    await forgotPassword(forgotRequest(coachEmail));
    const firstToken = vi.mocked(sendPasswordResetEmail).mock.calls[0][1];

    await forgotPassword(forgotRequest(coachEmail));
    const secondToken = vi.mocked(sendPasswordResetEmail).mock.calls[1][1];

    const res = await resetPassword(resetRequest(secondToken, "yetAnotherPassword789"));
    expect(res.status).toBe(200);

    // The first, still-unused link from before is now dead too.
    const staleAttempt = await resetPassword(resetRequest(firstToken, "shouldNeverWork000"));
    expect(staleAttempt.status).toBe(400);
  });

  it("rejects an expired token", async () => {
    const { sendPasswordResetEmail } = await import("@/lib/email");
    const { POST: forgotPassword } = await import("@/app/api/auth/forgot-password/route");
    const { POST: resetPassword } = await import("@/app/api/auth/reset-password/route");

    await forgotPassword(forgotRequest(coachEmail));
    const rawToken = vi.mocked(sendPasswordResetEmail).mock.calls[0][1];

    await prisma.passwordResetToken.updateMany({ where: { coachId }, data: { expiresAt: new Date(Date.now() - 1000) } });

    const res = await resetPassword(resetRequest(rawToken, "brandNewPassword123"));
    expect(res.status).toBe(400);
  });

  it("rejects a token that was never issued", async () => {
    const { POST: resetPassword } = await import("@/app/api/auth/reset-password/route");
    const res = await resetPassword(resetRequest("this-token-does-not-exist", "brandNewPassword123"));
    expect(res.status).toBe(400);
  });
});
