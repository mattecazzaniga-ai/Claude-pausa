import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createTestCoach, createTestSport, createTestAthlete, deleteTestCoach, deleteTestSport } from "../helpers/db";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));

function postRequest() {
  return new Request("http://localhost/api/athletes/x/performance-level", { method: "POST" });
}

describe("POST /api/athletes/[id]/performance-level", () => {
  let coachId: string;
  let sportId: string;

  beforeEach(async () => {
    const coach = await createTestCoach();
    coachId = coach.id;
    const sport = await createTestSport();
    sportId = sport.id;

    const { getServerSession } = await import("next-auth");
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: coachId, name: coach.name, email: coach.email } } as never);
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await deleteTestCoach(coachId);
    await deleteTestSport(sportId);
  });

  it("rejects an athlete belonging to another coach", async () => {
    const otherCoach = await createTestCoach();
    const athlete = await createTestAthlete(otherCoach.id, sportId);
    const { POST } = await import("@/app/api/athletes/[id]/performance-level/route");

    const res = await POST(postRequest(), { params: Promise.resolve({ id: athlete.id }) });
    expect(res.status).toBe(404);

    await deleteTestCoach(otherCoach.id);
  });

  it("returns INSUFFICIENT_DATA without needing the AI when the athlete has no evidence yet", async () => {
    const athlete = await createTestAthlete(coachId, sportId);
    const { POST } = await import("@/app/api/athletes/[id]/performance-level/route");

    const res = await POST(postRequest(), { params: Promise.resolve({ id: athlete.id }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.assessment.provenance).toBe("INSUFFICIENT_DATA");
    expect(data.assessment.level).toBeNull();
  });

  it("returns a 503 (not a crash) when there is real evidence but the AI isn't configured", async () => {
    const { prisma } = await import("@/lib/prisma");
    const athlete = await createTestAthlete(coachId, sportId);
    await prisma.evaluationCriterion.create({ data: { sportId, coachId, category: "Tecnica", name: "Precisione", scoreType: "SCALE_1_10" } }).then(async (criterion) => {
      const evaluation = await prisma.evaluation.create({ data: { coachId, athleteId: athlete.id, kind: "INITIAL" } });
      await prisma.evaluationScore.create({ data: { evaluationId: evaluation.id, criterionId: criterion.id, value: "7" } });
    });

    const { POST } = await import("@/app/api/athletes/[id]/performance-level/route");
    const res = await POST(postRequest(), { params: Promise.resolve({ id: athlete.id }) });
    expect(res.status).toBe(503);
  });
});
