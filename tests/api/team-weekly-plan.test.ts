import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createTestCoach, createTestSport, createTestAthlete, createTestTeam, deleteTestCoach, deleteTestSport } from "../helpers/db";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/ai", () => ({ isAiConfigured: true }));

vi.mock("@/lib/ai-weekly-plan", () => ({
  generateWeeklyPlanSkeleton: vi.fn().mockResolvedValue({
    phase: "CARICO",
    rationale: "Nessuno storico recente.",
    slots: [{ order: 1, intensity: "ALTA", discipline: "", focus: "Lavoro di squadra" }],
  }),
}));

vi.mock("@/lib/ai-session", () => ({
  generateSessionPlan: vi.fn().mockResolvedValue({ objective: "x", blocks: [] }),
  generateTeamSessionPlan: vi.fn().mockResolvedValue({ objective: "Obiettivo squadra", blocks: [] }),
}));

vi.mock("@/lib/ai-sport-profile", () => ({
  generateSportProfile: vi.fn().mockResolvedValue({
    formats: ["TEAM"],
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
  return new Request("http://localhost/api/teams/x/weekly-plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

describe("POST /api/teams/[id]/weekly-plan", () => {
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

  it("rejects a team with no members", async () => {
    const team = await createTestTeam(coachId, sportId, []);
    const { POST } = await import("@/app/api/teams/[id]/weekly-plan/route");

    const res = await POST(postRequest({ sessionsPerWeek: 3 }), { params: Promise.resolve({ id: team.id }) });
    expect(res.status).toBe(400);
  });

  it("creates a team plan and fills a slot into a real team session", async () => {
    const athlete = await createTestAthlete(coachId, sportId);
    const team = await createTestTeam(coachId, sportId, [athlete.id]);
    const { POST } = await import("@/app/api/teams/[id]/weekly-plan/route");

    const res = await POST(postRequest({ sessionsPerWeek: 1 }), { params: Promise.resolve({ id: team.id }) });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.plan.slots).toHaveLength(1);

    const { POST: fillPOST } = await import("@/app/api/teams/[id]/weekly-plan/slots/[slotId]/fill/route");
    const fillRes = await fillPOST(
      new Request("http://localhost/x", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ durationMinutes: 75 }) }),
      { params: Promise.resolve({ id: team.id, slotId: data.plan.slots[0].id }) }
    );
    const fillData = await fillRes.json();
    expect(fillRes.status).toBe(200);
    expect(fillData.sessionId).toBeTruthy();
  });
});
