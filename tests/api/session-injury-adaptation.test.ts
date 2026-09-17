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

describe("POST /api/athletes/[id]/sessions — injury-aware generation", () => {
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

  it("passes the active limitation into the AI prompt and records it on the session", async () => {
    const athlete = await createTestAthlete(coachId, sportId);
    await prisma.athleteInjury.create({
      data: { athleteId: athlete.id, coachId, type: "FASTIDIO", bodyRegion: "Spalla", side: "RIGHT", status: "MONITORING", reportedLimitations: "evitare overhead" },
    });

    const { POST } = await import("@/app/api/athletes/[id]/sessions/route");
    const res = await POST(postRequest({ durationMinutes: 60 }), { params: Promise.resolve({ id: athlete.id }) });
    expect(res.status).toBe(200);
    const data = await res.json();

    const trainingSession = await prisma.trainingSession.findUnique({ where: { id: data.sessionId } });
    expect(trainingSession?.adaptationNote).toContain("Spalla");

    const { generateSessionPlan } = await import("@/lib/ai-session");
    const call = vi.mocked(generateSessionPlan).mock.calls[0][0];
    expect(call.injuryConstraints).toContain("Spalla");
    expect(call.injuryConstraints).toContain("evitare overhead");
    expect(call.injuryConstraints).toContain("NON diagnosi mediche");
  });

  it("never treats a resolved injury as active (historical injury requirement)", async () => {
    const athlete = await createTestAthlete(coachId, sportId);
    await prisma.athleteInjury.create({
      data: { athleteId: athlete.id, coachId, type: "INFORTUNIO", bodyRegion: "Ginocchio", status: "RESOLVED" },
    });

    const { POST } = await import("@/app/api/athletes/[id]/sessions/route");
    const res = await POST(postRequest({ durationMinutes: 60 }), { params: Promise.resolve({ id: athlete.id }) });
    const data = await res.json();

    const trainingSession = await prisma.trainingSession.findUnique({ where: { id: data.sessionId } });
    expect(trainingSession?.adaptationNote).toBeNull();

    const { generateSessionPlan } = await import("@/lib/ai-session");
    const call = vi.mocked(generateSessionPlan).mock.calls[0][0];
    expect(call.injuryConstraints).toBeUndefined();
  });
});
