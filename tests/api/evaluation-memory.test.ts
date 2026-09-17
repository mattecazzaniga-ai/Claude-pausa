import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { createTestCoach, createTestSport, createTestAthlete, createTestTeam, deleteTestCoach, deleteTestSport } from "../helpers/db";
import { getRelevantAthleteMemories, getRelevantTeamMemories } from "@/lib/memory";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/ai", () => ({ isAiConfigured: true }));

vi.mock("@/lib/ai-evaluation", () => ({
  analyzeEvaluationProgress: vi.fn().mockResolvedValue({
    narrative: "Buon miglioramento tecnico, ma la resistenza è ancora sotto target.",
    priorities: [{ skill: "Resistenza aerobica", reason: "Punteggio stagnante rispetto alla valutazione precedente." }],
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
  return new Request("http://localhost/x", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

describe("Coaching Memory updates after a periodic evaluation", () => {
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

  it("records an athlete memory from a periodic evaluation's recurring priority", async () => {
    const athlete = await createTestAthlete(coachId, sportId);
    const criterion = await prisma.evaluationCriterion.create({
      data: { coachId, sportId, name: "Resistenza aerobica", category: "Fisico", scoreType: "SCALE_1_10", order: 1 },
    });
    // An INITIAL evaluation first, so the next one is PERIODIC (has something to compare against).
    await prisma.evaluation.create({
      data: { coachId, athleteId: athlete.id, kind: "INITIAL", scores: { create: [{ criterionId: criterion.id, value: "5" }] } },
    });

    const { POST } = await import("@/app/api/athletes/[id]/evaluations/route");
    const res = await POST(postRequest({ scores: [{ criterionId: criterion.id, value: "6" }] }), { params: Promise.resolve({ id: athlete.id }) });
    expect(res.status).toBe(200);

    const memories = await getRelevantAthleteMemories(athlete.id);
    expect(memories).toHaveLength(1);
    expect(memories[0].summary).toContain("Resistenza aerobica");
  });

  it("records a team memory from a periodic evaluation's recurring priority", async () => {
    const team = await createTestTeam(coachId, sportId, []);
    const criterion = await prisma.evaluationCriterion.create({
      data: { coachId, sportId, name: "Resistenza aerobica", category: "Fisico", scoreType: "SCALE_1_10", order: 1 },
    });
    await prisma.evaluation.create({
      data: { coachId, teamId: team.id, kind: "INITIAL", scores: { create: [{ criterionId: criterion.id, value: "5" }] } },
    });

    const { POST } = await import("@/app/api/teams/[id]/evaluations/route");
    const res = await POST(postRequest({ scores: [{ criterionId: criterion.id, value: "6" }] }), { params: Promise.resolve({ id: team.id }) });
    expect(res.status).toBe(200);

    const memories = await getRelevantTeamMemories(team.id);
    expect(memories).toHaveLength(1);
    expect(memories[0].summary).toContain("Resistenza aerobica");
  });
});
