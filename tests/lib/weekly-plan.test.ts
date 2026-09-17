import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { createTestCoach, createTestSport, createTestAthlete, createTestTeam, deleteTestCoach, deleteTestSport } from "../helpers/db";

vi.mock("@/lib/ai", () => ({ isAiConfigured: true }));

vi.mock("@/lib/ai-weekly-plan", () => ({
  generateWeeklyPlanSkeleton: vi.fn().mockResolvedValue({
    phase: "CARICO",
    rationale: "Nessuno storico recente, si costruisce la base.",
    slots: [
      { order: 1, intensity: "ALTA", discipline: "", focus: "Lavoro di forza" },
      { order: 2, intensity: "BASSA", discipline: "", focus: "Recupero attivo" },
      { order: 3, intensity: "MEDIA", discipline: "", focus: "Tecnica" },
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

describe("createAthleteWeeklyPlan", () => {
  let coachId: string;
  let sportId: string;

  afterEach(async () => {
    if (coachId) await deleteTestCoach(coachId);
    if (sportId) await deleteTestSport(sportId);
  });

  it("persists the plan and one slot per requested session, and sets the athlete's default frequency", async () => {
    const coach = await createTestCoach();
    coachId = coach.id;
    const sport = await createTestSport();
    sportId = sport.id;
    const athlete = await createTestAthlete(coachId, sportId);

    const { createAthleteWeeklyPlan } = await import("@/lib/weekly-plan");
    const plan = await createAthleteWeeklyPlan(athlete.id, 3);

    expect(plan?.phase).toBe("CARICO");
    expect(plan?.slots).toHaveLength(3);
    expect(plan?.slots.map((s) => s.intensity)).toEqual(["ALTA", "BASSA", "MEDIA"]);

    const updated = await prisma.athlete.findUnique({ where: { id: athlete.id } });
    expect(updated?.trainingDaysPerWeek).toBe(3);
  });

  it("never fabricates a slot: throws if the AI returns a different number of sessions than requested", async () => {
    const coach = await createTestCoach();
    coachId = coach.id;
    const sport = await createTestSport();
    sportId = sport.id;
    const athlete = await createTestAthlete(coachId, sportId);

    const { generateWeeklyPlanSkeleton } = await import("@/lib/ai-weekly-plan");
    vi.mocked(generateWeeklyPlanSkeleton).mockResolvedValueOnce({
      phase: "CARICO",
      rationale: "x",
      slots: [{ order: 1, intensity: "ALTA", discipline: "", focus: "x" }],
    });

    const { createAthleteWeeklyPlan } = await import("@/lib/weekly-plan");
    await expect(createAthleteWeeklyPlan(athlete.id, 3)).rejects.toThrow("numero di sessioni richiesto");

    const plans = await prisma.weeklyTrainingPlan.findMany({ where: { athleteId: athlete.id } });
    expect(plans).toHaveLength(0);
  });
});

describe("fillAthletePlanSlot", () => {
  let coachId: string;
  let sportId: string;

  beforeEach(async () => {
    const coach = await createTestCoach();
    coachId = coach.id;
    const sport = await createTestSport();
    sportId = sport.id;
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await deleteTestCoach(coachId);
    await deleteTestSport(sportId);
  });

  it("generates and links a real session to the slot", async () => {
    const athlete = await createTestAthlete(coachId, sportId);
    const { createAthleteWeeklyPlan, fillAthletePlanSlot } = await import("@/lib/weekly-plan");
    const plan = await createAthleteWeeklyPlan(athlete.id, 3);
    const slot = plan!.slots[0];

    const sessionId = await fillAthletePlanSlot(slot.id, coachId, 60);
    expect(sessionId).toBeTruthy();

    const updatedSlot = await prisma.plannedSessionSlot.findUnique({ where: { id: slot.id } });
    expect(updatedSlot?.trainingSessionId).toBe(sessionId);

    const trainingSession = await prisma.trainingSession.findUnique({ where: { id: sessionId } });
    expect(trainingSession?.athleteId).toBe(athlete.id);
    expect(trainingSession?.durationMinutes).toBe(60);
  });

  it("passes the slot's discipline and focus into the session objective", async () => {
    const { generateWeeklyPlanSkeleton } = await import("@/lib/ai-weekly-plan");
    vi.mocked(generateWeeklyPlanSkeleton).mockResolvedValueOnce({
      phase: "CARICO",
      rationale: "x",
      slots: [{ order: 1, intensity: "MEDIA", discipline: "Nuoto", focus: "Tecnica di virata" }],
    });

    const athlete = await createTestAthlete(coachId, sportId);
    const { createAthleteWeeklyPlan, fillAthletePlanSlot } = await import("@/lib/weekly-plan");
    const plan = await createAthleteWeeklyPlan(athlete.id, 1);
    const slot = plan!.slots[0];

    await fillAthletePlanSlot(slot.id, coachId, 45);

    const { generateSessionPlan } = await import("@/lib/ai-session");
    const call = vi.mocked(generateSessionPlan).mock.calls.at(-1)?.[0];
    expect(call?.sessionObjective).toBe("[Nuoto] Tecnica di virata");
  });

  it("refuses to fill a slot that already has a session", async () => {
    const { generateWeeklyPlanSkeleton } = await import("@/lib/ai-weekly-plan");
    vi.mocked(generateWeeklyPlanSkeleton).mockResolvedValueOnce({
      phase: "CARICO",
      rationale: "x",
      slots: [{ order: 1, intensity: "ALTA", discipline: "", focus: "x" }],
    });

    const athlete = await createTestAthlete(coachId, sportId);
    const { createAthleteWeeklyPlan, fillAthletePlanSlot } = await import("@/lib/weekly-plan");
    const plan = await createAthleteWeeklyPlan(athlete.id, 1);
    const slot = plan!.slots[0];

    await fillAthletePlanSlot(slot.id, coachId, 60);
    await expect(fillAthletePlanSlot(slot.id, coachId, 60)).rejects.toThrow("già una sessione");
  });

  it("refuses a slot belonging to another coach's plan", async () => {
    const { generateWeeklyPlanSkeleton } = await import("@/lib/ai-weekly-plan");
    vi.mocked(generateWeeklyPlanSkeleton).mockResolvedValueOnce({
      phase: "CARICO",
      rationale: "x",
      slots: [{ order: 1, intensity: "ALTA", discipline: "", focus: "x" }],
    });

    const athlete = await createTestAthlete(coachId, sportId);
    const { createAthleteWeeklyPlan, fillAthletePlanSlot } = await import("@/lib/weekly-plan");
    const plan = await createAthleteWeeklyPlan(athlete.id, 1);
    const slot = plan!.slots[0];

    const otherCoach = await createTestCoach();
    await expect(fillAthletePlanSlot(slot.id, otherCoach.id, 60)).rejects.toThrow("Slot not found");
    await deleteTestCoach(otherCoach.id);
  });
});

describe("createTeamWeeklyPlan / fillTeamPlanSlot", () => {
  let coachId: string;
  let sportId: string;

  afterEach(async () => {
    vi.clearAllMocks();
    if (coachId) await deleteTestCoach(coachId);
    if (sportId) await deleteTestSport(sportId);
  });

  it("persists a team plan and fills a slot into a team session", async () => {
    const coach = await createTestCoach();
    coachId = coach.id;
    const sport = await createTestSport();
    sportId = sport.id;
    const athlete = await createTestAthlete(coachId, sportId);
    const team = await createTestTeam(coachId, sportId, [athlete.id]);

    const { createTeamWeeklyPlan, fillTeamPlanSlot } = await import("@/lib/weekly-plan");
    const plan = await createTeamWeeklyPlan(team.id, 3);
    expect(plan?.slots).toHaveLength(3);

    const sessionId = await fillTeamPlanSlot(plan!.slots[0].id, coachId, 75);
    const trainingSession = await prisma.trainingSession.findUnique({ where: { id: sessionId } });
    expect(trainingSession?.teamId).toBe(team.id);

    const updated = await prisma.team.findUnique({ where: { id: team.id } });
    expect(updated?.trainingDaysPerWeek).toBe(3);
  });
});
