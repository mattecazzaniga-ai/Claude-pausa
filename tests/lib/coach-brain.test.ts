import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { recordCoachFeedbackSignal, forgetAthleteMemory, forgetTeamMemory } from "@/lib/intelligence/coach-brain";
import { createTestCoach, createTestSport, createTestAthlete, deleteTestCoach, deleteTestSport } from "../helpers/db";

describe("Coach Brain memory", () => {
  let coachId: string;
  let sportId: string;

  afterEach(async () => {
    if (coachId) await deleteTestCoach(coachId);
    if (sportId) await deleteTestSport(sportId);
  });

  it("tags a recorded signal with the athlete/team it came from", async () => {
    const coach = await createTestCoach();
    coachId = coach.id;
    const sport = await createTestSport();
    sportId = sport.id;
    const athlete = await createTestAthlete(coachId, sportId);

    await recordCoachFeedbackSignal(coachId, "EXERCISE_REPLACED", "test summary", undefined, { athleteId: athlete.id });

    const signals = await prisma.coachFeedbackSignal.findMany({ where: { coachId } });
    expect(signals).toHaveLength(1);
    expect(signals[0].athleteId).toBe(athlete.id);
    expect(signals[0].teamId).toBeNull();
  });

  it("forgetAthleteMemory removes only signals tagged to that athlete", async () => {
    const coach = await createTestCoach();
    coachId = coach.id;
    const sport = await createTestSport();
    sportId = sport.id;
    const athleteA = await createTestAthlete(coachId, sportId, { name: "Atleta A" });
    const athleteB = await createTestAthlete(coachId, sportId, { name: "Atleta B" });

    await recordCoachFeedbackSignal(coachId, "EXERCISE_REPLACED", "da A", undefined, { athleteId: athleteA.id });
    await recordCoachFeedbackSignal(coachId, "EXERCISE_REPLACED", "da B", undefined, { athleteId: athleteB.id });
    await recordCoachFeedbackSignal(coachId, "SESSION_FEEDBACK", "senza atleta collegato");

    await forgetAthleteMemory(coachId, athleteA.id);

    const remaining = await prisma.coachFeedbackSignal.findMany({ where: { coachId } });
    expect(remaining.map((s) => s.summary).sort()).toEqual(["da B", "senza atleta collegato"]);
  });

  it("forgetTeamMemory removes only signals tagged to that team", async () => {
    const coach = await createTestCoach();
    coachId = coach.id;
    const sport = await createTestSport();
    sportId = sport.id;
    const team = await prisma.team.create({ data: { coachId, sportId, name: "Squadra di prova" } });

    await recordCoachFeedbackSignal(coachId, "RECOMMENDATION_FEEDBACK", "dalla squadra", undefined, { teamId: team.id });
    await recordCoachFeedbackSignal(coachId, "RECOMMENDATION_FEEDBACK", "non collegata");

    await forgetTeamMemory(coachId, team.id);

    const remaining = await prisma.coachFeedbackSignal.findMany({ where: { coachId } });
    expect(remaining.map((s) => s.summary)).toEqual(["non collegata"]);

    await prisma.team.delete({ where: { id: team.id } });
  });

  it("clears the cached synthesis outright when too few signals are left to support it", async () => {
    const coach = await createTestCoach();
    coachId = coach.id;
    const sport = await createTestSport();
    sportId = sport.id;
    const athlete = await createTestAthlete(coachId, sportId);

    await prisma.coach.update({
      where: { id: coachId },
      data: { learnedPreferences: [{ insight: "vecchio pattern", evidenceCount: 3, category: "OTHER" }], learnedPreferencesUpdatedAt: new Date() },
    });
    await recordCoachFeedbackSignal(coachId, "EXERCISE_REPLACED", "unico segnale", undefined, { athleteId: athlete.id });

    await forgetAthleteMemory(coachId, athlete.id);

    const updated = await prisma.coach.findUniqueOrThrow({ where: { id: coachId } });
    expect(updated.learnedPreferences).toBeNull();
    expect(updated.learnedPreferencesUpdatedAt).toBeNull();
  });

  it("only invalidates the staleness timestamp when enough other signals remain", async () => {
    const coach = await createTestCoach();
    coachId = coach.id;
    const sport = await createTestSport();
    sportId = sport.id;
    const athlete = await createTestAthlete(coachId, sportId);

    const cachedPreferences = [{ insight: "pattern osservato altrove", evidenceCount: 4, category: "OTHER" }];
    await prisma.coach.update({
      where: { id: coachId },
      data: { learnedPreferences: cachedPreferences, learnedPreferencesUpdatedAt: new Date() },
    });

    await recordCoachFeedbackSignal(coachId, "EXERCISE_REPLACED", "da dimenticare", undefined, { athleteId: athlete.id });
    for (let i = 0; i < 5; i++) {
      await recordCoachFeedbackSignal(coachId, "SESSION_FEEDBACK", `segnale indipendente ${i}`);
    }

    await forgetAthleteMemory(coachId, athlete.id);

    const updated = await prisma.coach.findUniqueOrThrow({ where: { id: coachId } });
    // Still enough evidence overall — the cache is invalidated (will recompute
    // lazily on next use) but not wiped, and the tagged signal is gone.
    expect(updated.learnedPreferencesUpdatedAt).toBeNull();
    expect(updated.learnedPreferences).toEqual(cachedPreferences);
    const remaining = await prisma.coachFeedbackSignal.findMany({ where: { coachId, athleteId: athlete.id } });
    expect(remaining).toHaveLength(0);
  });
});
