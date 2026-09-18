import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { createTestCoach, createTestSport, createTestAthlete, deleteTestCoach, deleteTestSport } from "../helpers/db";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/ai", () => ({ isAiConfigured: true }));
vi.mock("@/lib/ai-sport-metrics", () => ({
  generateSportMetrics: vi.fn().mockResolvedValue({
    metrics: [{ name: "Tempo sui 5km (rigenerata)", unit: "min", description: "", direction: "LOWER_IS_BETTER" }],
  }),
}));
vi.mock("@/lib/ai-sport-profile", () => ({
  generateSportProfile: vi.fn().mockResolvedValue({
    formats: ["INDIVIDUAL"],
    environment: "",
    equipment: "",
    scoringSystem: "",
    keyRules: "",
    terminology: "",
    positions: "",
    movementPatterns: "",
    gameSituations: "",
    trainingMethods: "",
    commonProblems: "",
    progressions: "",
    safetyNotes: "",
    disciplines: [],
  }),
}));

function postRequest(body: unknown) {
  return new Request("http://localhost/api/coach/sport-metrics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/coach/sport-metrics — custom metrics on top of the shared set", () => {
  let coachId: string;
  let sportId: string;

  beforeEach(async () => {
    const coach = await createTestCoach();
    coachId = coach.id;
    const sport = await createTestSport();
    sportId = sport.id;
    await prisma.coach.update({ where: { id: coachId }, data: { primarySportId: sportId } });

    const { getServerSession } = await import("next-auth");
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: coachId, name: coach.name, email: coach.email } } as never);
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await deleteTestCoach(coachId);
    await deleteTestSport(sportId);
  });

  it("requires a primary sport before adding a custom metric", async () => {
    await prisma.coach.update({ where: { id: coachId }, data: { primarySportId: null } });
    const { POST } = await import("@/app/api/coach/sport-metrics/route");

    const res = await POST(postRequest({ name: "Tempo sui 40km", direction: "LOWER_IS_BETTER" }));
    expect(res.status).toBe(409);
  });

  it("creates a custom metric and it shows up alongside the shared set for this athlete", async () => {
    await prisma.sportMetric.create({ data: { sportId, name: "Tempo sui 5km", unit: "min", direction: "LOWER_IS_BETTER" } });
    const athlete = await createTestAthlete(coachId, sportId);

    const { POST } = await import("@/app/api/coach/sport-metrics/route");
    const res = await POST(postRequest({ name: "Tempo sui 40km", unit: "min", direction: "LOWER_IS_BETTER" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.metric.name).toBe("Tempo sui 40km");
    expect(data.metric.coachId).toBe(coachId);

    const { GET } = await import("@/app/api/athletes/[id]/metrics/route");
    const listRes = await GET(new Request("http://localhost/x"), { params: Promise.resolve({ id: athlete.id }) });
    const listData = await listRes.json();
    expect(listData.metrics.map((m: { name: string }) => m.name).sort()).toEqual(["Tempo sui 40km", "Tempo sui 5km"]);
  });

  it("never shows another coach's custom metric on the same sport", async () => {
    const otherCoach = await createTestCoach();
    await prisma.sportMetric.create({ data: { sportId, coachId: otherCoach.id, name: "Metrica privata di un altro coach", direction: "HIGHER_IS_BETTER" } });
    const athlete = await createTestAthlete(coachId, sportId);

    const { GET } = await import("@/app/api/athletes/[id]/metrics/route");
    const listRes = await GET(new Request("http://localhost/x"), { params: Promise.resolve({ id: athlete.id }) });
    const listData = await listRes.json();
    expect(listData.metrics.map((m: { name: string }) => m.name)).not.toContain("Metrica privata di un altro coach");

    await deleteTestCoach(otherCoach.id);
  });

  it("a regeneration of the shared set (force) never wipes a coach's own custom metric", async () => {
    await prisma.sportMetric.create({ data: { sportId, coachId, name: "Tempo sui 40km", direction: "LOWER_IS_BETTER" } });

    const { ensureSportMetrics } = await import("@/lib/sport");
    // No AI configured in tests, so force is a no-op past the isAiConfigured
    // check — this just proves the shared-only delete scope is correct, not
    // the AI regeneration path itself.
    await ensureSportMetrics(sportId, { force: true });

    const stillThere = await prisma.sportMetric.findFirst({ where: { sportId, coachId, name: "Tempo sui 40km" } });
    expect(stillThere).not.toBeNull();
  });
});
