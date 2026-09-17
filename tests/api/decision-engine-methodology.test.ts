import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createTestCoach, createTestSport, createTestAthlete, deleteTestCoach, deleteTestSport } from "../helpers/db";
import { saveMethodologyVersion } from "@/lib/methodology";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/ai", () => ({ isAiConfigured: true }));

vi.mock("@/lib/intelligence/bottleneck", () => ({
  diagnoseBottleneck: vi.fn().mockResolvedValue({ hasEnoughData: false, evidence: [], bottleneckHypothesis: null, recommendedExperiment: null }),
}));
vi.mock("@/lib/intelligence/performance-level", () => ({
  assessPerformanceLevel: vi.fn().mockResolvedValue({ provenance: "INSUFFICIENT_DATA", level: null, explanation: null, basedOn: [] }),
}));
vi.mock("@/lib/intelligence/gap-engine", () => ({
  computeMainGap: vi.fn().mockResolvedValue({ hasEnoughData: false, objectiveTitle: null, current: null, target: null, unit: null, gapExplanation: null, priorityReason: null }),
}));

function postRequest() {
  return new Request("http://localhost/x", { method: "POST" });
}

describe("Decision Engine routes pass the coach's methodology through", () => {
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

  it("/diagnose passes the declared methodology as the second argument", async () => {
    const athlete = await createTestAthlete(coachId, sportId);
    await saveMethodologyVersion(coachId, [{ text: "Tecnica prima della fisicità per atleti giovani", category: "FILOSOFIA" }]);

    const { POST } = await import("@/app/api/athletes/[id]/diagnose/route");
    const res = await POST(postRequest(), { params: Promise.resolve({ id: athlete.id }) });
    expect(res.status).toBe(200);

    const { diagnoseBottleneck } = await import("@/lib/intelligence/bottleneck");
    const methodologyArg = vi.mocked(diagnoseBottleneck).mock.calls[0][1];
    expect(methodologyArg).toContain("Tecnica prima della fisicità per atleti giovani");
  });

  it("/performance-level passes the declared methodology as the second argument", async () => {
    const athlete = await createTestAthlete(coachId, sportId);
    await saveMethodologyVersion(coachId, [{ text: "Livello avanzato solo con almeno 3 competizioni regionali", category: "ALTRO" }]);

    const { POST } = await import("@/app/api/athletes/[id]/performance-level/route");
    const res = await POST(postRequest(), { params: Promise.resolve({ id: athlete.id }) });
    expect(res.status).toBe(200);

    const { assessPerformanceLevel } = await import("@/lib/intelligence/performance-level");
    const methodologyArg = vi.mocked(assessPerformanceLevel).mock.calls[0][1];
    expect(methodologyArg).toContain("Livello avanzato solo con almeno 3 competizioni regionali");
  });

  it("/gap passes the declared methodology as the second argument", async () => {
    const athlete = await createTestAthlete(coachId, sportId);
    await saveMethodologyVersion(coachId, [{ text: "Priorità alla progressione tecnica sugli obiettivi fisici", category: "PROGRESSIONE" }]);

    const { POST } = await import("@/app/api/athletes/[id]/gap/route");
    const res = await POST(postRequest(), { params: Promise.resolve({ id: athlete.id }) });
    expect(res.status).toBe(200);

    const { computeMainGap } = await import("@/lib/intelligence/gap-engine");
    const methodologyArg = vi.mocked(computeMainGap).mock.calls[0][1];
    expect(methodologyArg).toContain("Priorità alla progressione tecnica sugli obiettivi fisici");
  });

  it("passes null (not an error) when the coach has no declared methodology yet", async () => {
    const athlete = await createTestAthlete(coachId, sportId);

    const { POST } = await import("@/app/api/athletes/[id]/diagnose/route");
    await POST(postRequest(), { params: Promise.resolve({ id: athlete.id }) });

    const { diagnoseBottleneck } = await import("@/lib/intelligence/bottleneck");
    const methodologyArg = vi.mocked(diagnoseBottleneck).mock.calls[0][1];
    expect(methodologyArg).toBeNull();
  });
});
