import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { createTestCoach, createTestSport, createTestAthlete, deleteTestCoach, deleteTestSport } from "../helpers/db";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/ai", () => ({ isAiConfigured: true }));
vi.mock("@/lib/ai-sport-profile", () => ({
  generateSportProfile: vi.fn().mockResolvedValue({
    formats: ["INDIVIDUAL"],
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
  generateSessionPlan: vi.fn().mockResolvedValue({ objective: "Obiettivo di prova", blocks: [] }),
}));

function postRequest(body: unknown) {
  return new Request("http://localhost/api/athletes/test/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/athletes/[id]/sessions — adaptive training", () => {
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

  it("does not adapt when the athlete has no checkins or session history", async () => {
    const athlete = await createTestAthlete(coachId, sportId);
    const { POST } = await import("@/app/api/athletes/[id]/sessions/route");

    const res = await POST(postRequest({ durationMinutes: 60 }), { params: Promise.resolve({ id: athlete.id }) });
    expect(res.status).toBe(200);
    const data = await res.json();

    const trainingSession = await prisma.trainingSession.findUnique({ where: { id: data.sessionId } });
    expect(trainingSession?.adaptationNote).toBeNull();

    const { generateSessionPlan } = await import("@/lib/ai-session");
    expect(vi.mocked(generateSessionPlan).mock.calls[0][0].adaptationDirective).toBeUndefined();
  });

  it("reduces load and persists an adaptation note when readiness is low", async () => {
    const athlete = await createTestAthlete(coachId, sportId);
    await prisma.athleteCheckin.create({ data: { athleteId: athlete.id, coachId, readiness: 2, soreness: 9 } });

    const { POST } = await import("@/app/api/athletes/[id]/sessions/route");
    const res = await POST(postRequest({ durationMinutes: 60 }), { params: Promise.resolve({ id: athlete.id }) });
    expect(res.status).toBe(200);
    const data = await res.json();

    const trainingSession = await prisma.trainingSession.findUnique({ where: { id: data.sessionId } });
    expect(trainingSession?.adaptationNote).toContain("Carico ridotto");
    expect(trainingSession?.adaptationNote).toContain("prontezza bassa");

    const { generateSessionPlan } = await import("@/lib/ai-session");
    const directive = vi.mocked(generateSessionPlan).mock.calls[0][0].adaptationDirective;
    expect(directive).toContain("riduci il carico");
  });
});
