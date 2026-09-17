import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { createTestCoach, createTestSport, createTestAthlete, deleteTestCoach, deleteTestSport } from "../helpers/db";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));

function postRequest() {
  return new Request("http://localhost/api/athletes/x/gap", { method: "POST" });
}

describe("POST /api/athletes/[id]/gap", () => {
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
    const { POST } = await import("@/app/api/athletes/[id]/gap/route");

    const res = await POST(postRequest(), { params: Promise.resolve({ id: athlete.id }) });
    expect(res.status).toBe(404);

    await deleteTestCoach(otherCoach.id);
  });

  it("reports no gap without needing the AI when there is no eligible quantitative objective", async () => {
    const athlete = await createTestAthlete(coachId, sportId);
    const { POST } = await import("@/app/api/athletes/[id]/gap/route");

    const res = await POST(postRequest(), { params: Promise.resolve({ id: athlete.id }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.gap.hasEnoughData).toBe(false);
  });

  it("returns a 503 (not a crash) once a quantitative objective has real current/target values but the AI isn't configured", async () => {
    const athlete = await createTestAthlete(coachId, sportId);
    await prisma.objective.create({
      data: {
        coachId,
        athleteId: athlete.id,
        title: "Sub 20' sui 5km",
        termLength: "MEDIUM",
        kind: "QUANTITATIVE",
        baselineValue: "25",
        currentValue: "22",
        targetValue: "20",
        unit: "min",
      },
    });

    const { POST } = await import("@/app/api/athletes/[id]/gap/route");
    const res = await POST(postRequest(), { params: Promise.resolve({ id: athlete.id }) });
    expect(res.status).toBe(503);
  });
});
