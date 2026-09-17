import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { createTestCoach, createTestSport, createTestAthlete, deleteTestCoach, deleteTestSport } from "../helpers/db";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));

describe("GET /api/athletes/[id]/baseline", () => {
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
    const { GET } = await import("@/app/api/athletes/[id]/baseline/route");

    const res = await GET(new Request("http://localhost/api/athletes/x/baseline"), { params: Promise.resolve({ id: athlete.id }) });
    expect(res.status).toBe(404);

    await deleteTestCoach(otherCoach.id);
  });

  it("returns an empty baseline for an athlete with no recorded metric values", async () => {
    const athlete = await createTestAthlete(coachId, sportId);
    const { GET } = await import("@/app/api/athletes/[id]/baseline/route");

    const res = await GET(new Request("http://localhost/api/athletes/x/baseline"), { params: Promise.resolve({ id: athlete.id }) });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.baseline).toHaveLength(0);
  });

  it("returns per-metric initial/current/best once values are recorded", async () => {
    const athlete = await createTestAthlete(coachId, sportId);
    const metric = await prisma.sportMetric.create({ data: { sportId, name: "Tempo sui 5km", unit: "min", direction: "LOWER_IS_BETTER" } });
    await prisma.athleteMetricValue.create({ data: { athleteId: athlete.id, coachId, sportMetricId: metric.id, value: 25, recordedAt: new Date("2024-01-01") } });
    await prisma.athleteMetricValue.create({ data: { athleteId: athlete.id, coachId, sportMetricId: metric.id, value: 21, recordedAt: new Date("2024-06-01") } });

    const { GET } = await import("@/app/api/athletes/[id]/baseline/route");
    const res = await GET(new Request("http://localhost/api/athletes/x/baseline"), { params: Promise.resolve({ id: athlete.id }) });
    const data = await res.json();

    expect(data.baseline).toHaveLength(1);
    expect(data.baseline[0].initialValue).toBe(25);
    expect(data.baseline[0].currentValue).toBe(21);
    expect(data.baseline[0].personalBest.value).toBe(21);
  });
});
