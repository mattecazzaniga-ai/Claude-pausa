import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createTestCoach, createTestSport, createTestAthlete, deleteTestCoach, deleteTestSport } from "../helpers/db";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/ai", () => ({ isAiConfigured: true }));

vi.mock("@/lib/ai-weekly-plan", () => ({
  generateWeeklyPlanSkeleton: vi.fn().mockResolvedValue({
    phase: "CARICO",
    rationale: "Nessuno storico recente.",
    slots: [
      { order: 1, intensity: "ALTA", discipline: "", focus: "Lavoro di forza" },
      { order: 2, intensity: "BASSA", discipline: "", focus: "Recupero" },
    ],
  }),
}));

vi.mock("@/lib/ai-session", () => ({
  generateSessionPlan: vi.fn().mockResolvedValue({ objective: "Obiettivo di prova", blocks: [] }),
  generateTeamSessionPlan: vi.fn().mockResolvedValue({ objective: "Obiettivo di prova squadra", blocks: [] }),
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
  return new Request("http://localhost/api/athletes/x/weekly-plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST/GET /api/athletes/[id]/weekly-plan", () => {
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
    const { POST } = await import("@/app/api/athletes/[id]/weekly-plan/route");

    const res = await POST(postRequest({ sessionsPerWeek: 3 }), { params: Promise.resolve({ id: athlete.id }) });
    expect(res.status).toBe(404);

    await deleteTestCoach(otherCoach.id);
  });

  it("rejects an invalid sessionsPerWeek", async () => {
    const athlete = await createTestAthlete(coachId, sportId);
    const { POST } = await import("@/app/api/athletes/[id]/weekly-plan/route");

    const res = await POST(postRequest({ sessionsPerWeek: 0 }), { params: Promise.resolve({ id: athlete.id }) });
    expect(res.status).toBe(400);
  });

  it("GET returns null when no plan exists yet", async () => {
    const athlete = await createTestAthlete(coachId, sportId);
    const { GET } = await import("@/app/api/athletes/[id]/weekly-plan/route");

    const res = await GET(new Request("http://localhost/api/athletes/x/weekly-plan"), { params: Promise.resolve({ id: athlete.id }) });
    const data = await res.json();
    expect(data.plan).toBeNull();
  });

  it("creates a plan, then fills a slot into a real session", async () => {
    const athlete = await createTestAthlete(coachId, sportId);
    const { POST } = await import("@/app/api/athletes/[id]/weekly-plan/route");

    const res = await POST(postRequest({ sessionsPerWeek: 2 }), { params: Promise.resolve({ id: athlete.id }) });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.plan.slots).toHaveLength(2);

    const { POST: fillPOST } = await import("@/app/api/athletes/[id]/weekly-plan/slots/[slotId]/fill/route");
    const fillRes = await fillPOST(
      new Request("http://localhost/x", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ durationMinutes: 60 }) }),
      { params: Promise.resolve({ id: athlete.id, slotId: data.plan.slots[0].id }) }
    );
    const fillData = await fillRes.json();
    expect(fillRes.status).toBe(200);
    expect(fillData.sessionId).toBeTruthy();
  });

  it("returns 409 when trying to fill an already-filled slot", async () => {
    const { generateWeeklyPlanSkeleton } = await import("@/lib/ai-weekly-plan");
    vi.mocked(generateWeeklyPlanSkeleton).mockResolvedValueOnce({
      phase: "CARICO",
      rationale: "x",
      slots: [{ order: 1, intensity: "ALTA", discipline: "", focus: "x" }],
    });

    const athlete = await createTestAthlete(coachId, sportId);
    const { POST } = await import("@/app/api/athletes/[id]/weekly-plan/route");
    const res = await POST(postRequest({ sessionsPerWeek: 1 }), { params: Promise.resolve({ id: athlete.id }) });
    const data = await res.json();

    const { POST: fillPOST } = await import("@/app/api/athletes/[id]/weekly-plan/slots/[slotId]/fill/route");
    const fillRequest = () =>
      fillPOST(new Request("http://localhost/x", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ durationMinutes: 60 }) }), {
        params: Promise.resolve({ id: athlete.id, slotId: data.plan.slots[0].id }),
      });

    await fillRequest();
    const second = await fillRequest();
    expect(second.status).toBe(409);
  });
});
