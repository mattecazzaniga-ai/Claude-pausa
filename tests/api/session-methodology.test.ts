import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { createTestCoach, createTestSport, createTestAthlete, deleteTestCoach, deleteTestSport } from "../helpers/db";
import { saveMethodologyVersion } from "@/lib/methodology";

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

describe("POST /api/athletes/[id]/sessions — methodology-aware generation", () => {
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

  it("does not pass methodology text when the coach has none saved", async () => {
    const athlete = await createTestAthlete(coachId, sportId);
    const { POST } = await import("@/app/api/athletes/[id]/sessions/route");

    const res = await POST(postRequest({ durationMinutes: 60 }), { params: Promise.resolve({ id: athlete.id }) });
    const data = await res.json();

    const { generateSessionPlan } = await import("@/lib/ai-session");
    const call = vi.mocked(generateSessionPlan).mock.calls[0][0];
    expect(call.methodologyText).toBeUndefined();

    const trainingSession = await prisma.trainingSession.findUnique({ where: { id: data.sessionId } });
    expect(trainingSession?.methodologyVersion).toBeNull();
  });

  it("passes the coach's declared methodology into the AI prompt and stamps the version on the session", async () => {
    const athlete = await createTestAthlete(coachId, sportId);
    await saveMethodologyVersion(coachId, [{ text: "Non aumento volume e intensità insieme", category: "VOLUME" }]);

    const { POST } = await import("@/app/api/athletes/[id]/sessions/route");
    const res = await POST(postRequest({ durationMinutes: 60 }), { params: Promise.resolve({ id: athlete.id }) });
    const data = await res.json();

    const { generateSessionPlan } = await import("@/lib/ai-session");
    const call = vi.mocked(generateSessionPlan).mock.calls[0][0];
    expect(call.methodologyText).toContain("Non aumento volume e intensità insieme");
    expect(call.methodologyText).toContain("METODOLOGIA DICHIARATA DA QUESTO ALLENATORE");

    const trainingSession = await prisma.trainingSession.findUnique({ where: { id: data.sessionId } });
    expect(trainingSession?.methodologyVersion).toBe(1);
  });
});
