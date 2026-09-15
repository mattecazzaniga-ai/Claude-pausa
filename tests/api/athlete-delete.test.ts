import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { recordCoachFeedbackSignal } from "@/lib/intelligence/coach-brain";
import { createTestCoach, createTestSport, createTestAthlete, deleteTestCoach, deleteTestSport } from "../helpers/db";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));

function deleteRequest(forgetAiMemory?: boolean) {
  return new Request("http://localhost/api/athletes/test", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(forgetAiMemory === undefined ? {} : { forgetAiMemory }),
  });
}

describe("DELETE /api/athletes/[id]", () => {
  let coachId: string;
  let sportId: string;

  beforeEach(async () => {
    const coach = await createTestCoach();
    coachId = coach.id;
    const sport = await createTestSport();
    sportId = sport.id;

    const { getServerSession } = await import("next-auth");
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: coachId, name: "Test Coach", email: coach.email } } as never);
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await deleteTestCoach(coachId);
    await deleteTestSport(sportId);
  });

  it("keeps the coach-brain signals from this athlete by default", async () => {
    const athlete = await createTestAthlete(coachId, sportId);
    await recordCoachFeedbackSignal(coachId, "EXERCISE_REPLACED", "test", undefined, { athleteId: athlete.id });

    const { DELETE } = await import("@/app/api/athletes/[id]/route");
    const res = await DELETE(deleteRequest(false), { params: Promise.resolve({ id: athlete.id }) });
    expect(res.status).toBe(200);

    const signals = await prisma.coachFeedbackSignal.findMany({ where: { coachId } });
    expect(signals).toHaveLength(1);
    // The athlete is gone, so the DB's own ON DELETE SET NULL already cleared the link.
    expect(signals[0].athleteId).toBeNull();
  });

  it("removes the coach-brain signals from this athlete when forgetAiMemory is true", async () => {
    const athlete = await createTestAthlete(coachId, sportId);
    await recordCoachFeedbackSignal(coachId, "EXERCISE_REPLACED", "test", undefined, { athleteId: athlete.id });

    const { DELETE } = await import("@/app/api/athletes/[id]/route");
    const res = await DELETE(deleteRequest(true), { params: Promise.resolve({ id: athlete.id }) });
    expect(res.status).toBe(200);

    const signals = await prisma.coachFeedbackSignal.findMany({ where: { coachId } });
    expect(signals).toHaveLength(0);
  });

  it("defaults to keeping memory when no body is sent", async () => {
    const athlete = await createTestAthlete(coachId, sportId);
    await recordCoachFeedbackSignal(coachId, "EXERCISE_REPLACED", "test", undefined, { athleteId: athlete.id });

    const { DELETE } = await import("@/app/api/athletes/[id]/route");
    const res = await DELETE(deleteRequest(undefined), { params: Promise.resolve({ id: athlete.id }) });
    expect(res.status).toBe(200);

    const signals = await prisma.coachFeedbackSignal.findMany({ where: { coachId } });
    expect(signals).toHaveLength(1);
  });
});
