import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { createTestCoach, createTestSport, createTestAthlete, createTestTeam, deleteTestCoach, deleteTestSport } from "../helpers/db";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/ai", () => ({ isAiConfigured: true }));
vi.mock("@/lib/ai-sport-profile", () => ({
  generateSportProfile: vi.fn().mockResolvedValue({
    formats: ["TEAM"],
    environment: "Campo di prova",
    equipment: "Attrezzo di prova",
    scoringSystem: "Punteggio di prova",
    keyRules: "Regola di prova",
    terminology: "Termine di prova",
    positions: "",
    movementPatterns: "",
    gameSituations: "",
    trainingMethods: "",
    commonProblems: "",
    progressions: "",
    safetyNotes: "",
  }),
}));
vi.mock("@/lib/ai-session", () => ({
  generateTeamSessionPlan: vi.fn().mockResolvedValue({ objective: "Obiettivo di prova", blocks: [] }),
}));

function postRequest(body: unknown) {
  return new Request("http://localhost/api/teams/test/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/teams/[id]/sessions — team adaptive training", () => {
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

  it("does not adapt when no member has a recent checkin", async () => {
    const a1 = await createTestAthlete(coachId, sportId);
    const a2 = await createTestAthlete(coachId, sportId);
    const team = await createTestTeam(coachId, sportId, [a1.id, a2.id]);

    const { POST } = await import("@/app/api/teams/[id]/sessions/route");
    const res = await POST(postRequest({ durationMinutes: 60 }), { params: Promise.resolve({ id: team.id }) });
    expect(res.status).toBe(200);
    const data = await res.json();

    const trainingSession = await prisma.trainingSession.findUnique({ where: { id: data.sessionId } });
    expect(trainingSession?.adaptationNote).toBeNull();
  });

  it("reduces load when at least half the checked-in members show fatigue", async () => {
    const a1 = await createTestAthlete(coachId, sportId);
    const a2 = await createTestAthlete(coachId, sportId);
    const team = await createTestTeam(coachId, sportId, [a1.id, a2.id]);
    await prisma.athleteCheckin.create({ data: { athleteId: a1.id, coachId, readiness: 2 } });

    const { POST } = await import("@/app/api/teams/[id]/sessions/route");
    const res = await POST(postRequest({ durationMinutes: 60 }), { params: Promise.resolve({ id: team.id }) });
    expect(res.status).toBe(200);
    const data = await res.json();

    const trainingSession = await prisma.trainingSession.findUnique({ where: { id: data.sessionId } });
    expect(trainingSession?.adaptationNote).toContain("Carico ridotto");

    const { generateTeamSessionPlan } = await import("@/lib/ai-session");
    const directive = vi.mocked(generateTeamSessionPlan).mock.calls[0][0].adaptationDirective;
    expect(directive).toContain("riduci il carico");
  });
});
