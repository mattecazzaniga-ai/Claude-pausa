import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { createTestCoach, createTestSport, createTestAthlete, createTestTeam, deleteTestCoach, deleteTestSport } from "../helpers/db";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/ai", () => ({ isAiConfigured: true }));

vi.mock("@/lib/ai-competition", () => ({
  analyzeCompetitionPerformance: vi.fn().mockResolvedValue({
    narrative: "Buona prestazione tecnica, ma il problema in difesa è ricomparso.",
    priorities: [{ skill: "Difesa sotto pressione", reason: "Problema ricomparso nel secondo set." }],
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

function patchRequest(body: unknown) {
  return new Request("http://localhost/x", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

describe("14) Coaching Memory updates after a competition result", () => {
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

  it("records a new athlete memory from a recurring post-competition priority", async () => {
    const athlete = await createTestAthlete(coachId, sportId);
    const competition = await prisma.competition.create({
      data: { coachId, athleteId: athlete.id, sportId, name: "Torneo di prova", type: "TOURNAMENT", scheduledAt: new Date() },
    });

    const { PATCH } = await import("@/app/api/athletes/[id]/competitions/[competitionId]/route");
    const res = await PATCH(patchRequest({ result: "LOSS", score: "6-4, 4-6, 3-6" }), { params: Promise.resolve({ id: athlete.id, competitionId: competition.id }) });
    expect(res.status).toBe(200);

    const { getRelevantAthleteMemories } = await import("@/lib/memory");
    const memories = await getRelevantAthleteMemories(athlete.id);
    expect(memories).toHaveLength(1);
    expect(memories[0].summary).toContain("Difesa sotto pressione");
    expect(memories[0].evidenceCount).toBe(1);
  });

  it("strengthens the same memory when the same priority resurfaces after a second competition", async () => {
    const athlete = await createTestAthlete(coachId, sportId);
    const competition1 = await prisma.competition.create({
      data: { coachId, athleteId: athlete.id, sportId, name: "Torneo 1", type: "TOURNAMENT", scheduledAt: new Date() },
    });
    const competition2 = await prisma.competition.create({
      data: { coachId, athleteId: athlete.id, sportId, name: "Torneo 2", type: "TOURNAMENT", scheduledAt: new Date() },
    });

    const { PATCH } = await import("@/app/api/athletes/[id]/competitions/[competitionId]/route");
    await PATCH(patchRequest({ result: "LOSS" }), { params: Promise.resolve({ id: athlete.id, competitionId: competition1.id }) });
    await PATCH(patchRequest({ result: "LOSS" }), { params: Promise.resolve({ id: athlete.id, competitionId: competition2.id }) });

    const { getRelevantAthleteMemories } = await import("@/lib/memory");
    const memories = await getRelevantAthleteMemories(athlete.id);
    expect(memories).toHaveLength(1); // strengthened, not duplicated
    expect(memories[0].evidenceCount).toBe(2);
    expect(memories[0].confidence).toBe("PATTERN");
  });

  it("records a team memory from a recurring post-competition priority", async () => {
    const team = await createTestTeam(coachId, sportId, []);
    const competition = await prisma.competition.create({
      data: { coachId, teamId: team.id, sportId, name: "Campionato", type: "LEAGUE", scheduledAt: new Date() },
    });

    const { PATCH } = await import("@/app/api/teams/[id]/competitions/[competitionId]/route");
    const res = await PATCH(patchRequest({ result: "LOSS" }), { params: Promise.resolve({ id: team.id, competitionId: competition.id }) });
    expect(res.status).toBe(200);

    const { getRelevantTeamMemories } = await import("@/lib/memory");
    const memories = await getRelevantTeamMemories(team.id);
    expect(memories).toHaveLength(1);
    expect(memories[0].summary).toContain("Difesa sotto pressione");
  });
});
