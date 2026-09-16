import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { createTestCoach, createTestSport, createTestAthlete, deleteTestCoach, deleteTestSport } from "../helpers/db";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));

function postRequest(body: unknown) {
  return new Request("http://localhost/api/athletes/test/metrics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/athletes/[id]/metrics", () => {
  let coachId: string;
  let sportId: string;
  let sportMetricId: string;

  beforeEach(async () => {
    const coach = await createTestCoach();
    coachId = coach.id;
    const sport = await createTestSport();
    sportId = sport.id;
    const metric = await prisma.sportMetric.create({ data: { sportId, name: "Velocità 20m", unit: "s" } });
    sportMetricId = metric.id;

    const { getServerSession } = await import("next-auth");
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: coachId, name: "Test Coach", email: coach.email } } as never);
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await deleteTestCoach(coachId);
    await deleteTestSport(sportId);
  });

  it("records a metric value and lists it back with the metric definitions", async () => {
    const athlete = await createTestAthlete(coachId, sportId);
    const { POST, GET } = await import("@/app/api/athletes/[id]/metrics/route");

    const createRes = await POST(postRequest({ sportMetricId, value: 3.2 }), { params: Promise.resolve({ id: athlete.id }) });
    expect(createRes.status).toBe(200);

    const listRes = await GET(new Request("http://localhost/api/athletes/test/metrics"), { params: Promise.resolve({ id: athlete.id }) });
    const data = await listRes.json();
    expect(data.metrics).toHaveLength(1);
    expect(data.metrics[0]).toMatchObject({ name: "Velocità 20m", unit: "s" });
    expect(data.values).toHaveLength(1);
    expect(data.values[0]).toMatchObject({ sportMetricId, value: 3.2 });
  });

  it("rejects a metric that belongs to a different sport", async () => {
    const athlete = await createTestAthlete(coachId, sportId);
    const otherSport = await createTestSport();
    const otherMetric = await prisma.sportMetric.create({ data: { sportId: otherSport.id, name: "Altra metrica" } });

    const { POST } = await import("@/app/api/athletes/[id]/metrics/route");
    const res = await POST(postRequest({ sportMetricId: otherMetric.id, value: 1 }), { params: Promise.resolve({ id: athlete.id }) });
    expect(res.status).toBe(400);

    await deleteTestSport(otherSport.id);
  });

  it("returns 404 for an athlete belonging to another coach", async () => {
    const otherCoach = await createTestCoach();
    const athlete = await createTestAthlete(otherCoach.id, sportId);
    const { POST } = await import("@/app/api/athletes/[id]/metrics/route");

    const res = await POST(postRequest({ sportMetricId, value: 1 }), { params: Promise.resolve({ id: athlete.id }) });
    expect(res.status).toBe(404);

    await deleteTestCoach(otherCoach.id);
  });
});
