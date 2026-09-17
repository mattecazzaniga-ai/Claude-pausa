import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { createTestCoach, createTestSport, createTestAthlete, createTestTeam, deleteTestCoach, deleteTestSport } from "../helpers/db";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/ai", () => ({ isAiConfigured: true }));

vi.mock("@/lib/ai-session", () => ({
  generateReplacementExercise: vi.fn().mockResolvedValue({
    type: "TECHNICAL",
    durationMinutes: 10,
    rationale: "Sostituzione di prova",
    chosenExerciseId: "",
    newExerciseName: "Esercizio di prova",
    newExerciseDescription: "",
    newExerciseCoachingPoints: "",
  }),
}));

function postRequest() {
  return new Request("http://localhost/x", { method: "POST" });
}

describe("POST /api/sessions/[id]/blocks/[blockId]/replace — injury-aware replacement", () => {
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

  it("passes the athlete's active limitation into the replacement prompt", async () => {
    const athlete = await createTestAthlete(coachId, sportId);
    await prisma.athleteInjury.create({
      data: { athleteId: athlete.id, coachId, type: "FASTIDIO", bodyRegion: "Ginocchio", side: "LEFT", status: "ACTIVE", reportedLimitations: "evitare cambi di direzione" },
    });
    const trainingSession = await prisma.trainingSession.create({
      data: { coachId, athleteId: athlete.id, sportId, durationMinutes: 60 },
    });
    const block = await prisma.sessionBlock.create({
      data: { trainingSessionId: trainingSession.id, order: 1, type: "TECHNICAL", durationMinutes: 10 },
    });

    const { POST } = await import("@/app/api/sessions/[id]/blocks/[blockId]/replace/route");
    const res = await POST(postRequest(), { params: Promise.resolve({ id: trainingSession.id, blockId: block.id }) });
    expect(res.status).toBe(200);

    const { generateReplacementExercise } = await import("@/lib/ai-session");
    const call = vi.mocked(generateReplacementExercise).mock.calls[0][0];
    expect(call.injuryConstraints).toContain("Ginocchio");
    expect(call.injuryConstraints).toContain("evitare cambi di direzione");
  });

  it("never sends injury constraints for a team session (no single athlete to adapt around)", async () => {
    const team = await createTestTeam(coachId, sportId, []);
    const trainingSession = await prisma.trainingSession.create({
      data: { coachId, teamId: team.id, sportId, durationMinutes: 60 },
    });
    const block = await prisma.sessionBlock.create({
      data: { trainingSessionId: trainingSession.id, order: 1, type: "TECHNICAL", durationMinutes: 10 },
    });

    const { POST } = await import("@/app/api/sessions/[id]/blocks/[blockId]/replace/route");
    const res = await POST(postRequest(), { params: Promise.resolve({ id: trainingSession.id, blockId: block.id }) });
    expect(res.status).toBe(200);

    const { generateReplacementExercise } = await import("@/lib/ai-session");
    const call = vi.mocked(generateReplacementExercise).mock.calls[0][0];
    expect(call.injuryConstraints).toBeUndefined();
  });
});
