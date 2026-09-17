import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  recordCoachFeedbackSignal,
  forgetAthleteMemory,
  forgetTeamMemory,
  getCoachLearnedPreferences,
  confirmCoachPreference,
  rejectCoachPreference,
  reactivateCoachPreference,
  getCoachBrainPromptText,
} from "@/lib/intelligence/coach-brain";
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

  it("clears unconfirmed preferences (never a CONFIRMED one) when too few signals are left to support them", async () => {
    const coach = await createTestCoach();
    coachId = coach.id;
    const sport = await createTestSport();
    sportId = sport.id;
    const athlete = await createTestAthlete(coachId, sportId);

    const confirmedPref = await prisma.coachLearnedPreference.create({
      data: { coachId, topic: "vecchio-pattern", insight: "vecchio pattern", category: "OTHER", evidenceCount: 3, reviewState: "CONFIRMED" },
    });
    const activePref = await prisma.coachLearnedPreference.create({
      data: { coachId, topic: "pattern-fragile", insight: "pattern fragile", category: "OTHER", evidenceCount: 2 },
    });
    await prisma.coach.update({ where: { id: coachId }, data: { coachBrainRefreshedAt: new Date() } });
    await recordCoachFeedbackSignal(coachId, "EXERCISE_REPLACED", "unico segnale", undefined, { athleteId: athlete.id });

    await forgetAthleteMemory(coachId, athlete.id);

    const updated = await prisma.coach.findUniqueOrThrow({ where: { id: coachId } });
    expect(updated.coachBrainRefreshedAt).toBeNull();

    const remainingPrefs = await prisma.coachLearnedPreference.findMany({ where: { coachId } });
    expect(remainingPrefs.map((p) => p.id)).toEqual([confirmedPref.id]);
    expect(remainingPrefs.find((p) => p.id === activePref.id)).toBeUndefined();
  });

  it("only invalidates the staleness timestamp (keeps all preferences) when enough other signals remain", async () => {
    const coach = await createTestCoach();
    coachId = coach.id;
    const sport = await createTestSport();
    sportId = sport.id;
    const athlete = await createTestAthlete(coachId, sportId);

    await prisma.coachLearnedPreference.create({
      data: { coachId, topic: "pattern-altrove", insight: "pattern osservato altrove", category: "OTHER", evidenceCount: 4 },
    });
    await prisma.coach.update({ where: { id: coachId }, data: { coachBrainRefreshedAt: new Date() } });

    await recordCoachFeedbackSignal(coachId, "EXERCISE_REPLACED", "da dimenticare", undefined, { athleteId: athlete.id });
    for (let i = 0; i < 5; i++) {
      await recordCoachFeedbackSignal(coachId, "SESSION_FEEDBACK", `segnale indipendente ${i}`);
    }

    await forgetAthleteMemory(coachId, athlete.id);

    const updated = await prisma.coach.findUniqueOrThrow({ where: { id: coachId } });
    // Still enough evidence overall — the cache is invalidated (will recompute
    // lazily on next use) but not wiped, and the tagged signal is gone.
    expect(updated.coachBrainRefreshedAt).toBeNull();
    const remainingPrefs = await prisma.coachLearnedPreference.findMany({ where: { coachId } });
    expect(remainingPrefs).toHaveLength(1);
    const remainingSignals = await prisma.coachFeedbackSignal.findMany({ where: { coachId, athleteId: athlete.id } });
    expect(remainingSignals).toHaveLength(0);
  });

  it("confirming a preference is the only path to CONFIRMED — never automatic", async () => {
    sportId = "";
    const coach = await createTestCoach();
    coachId = coach.id;
    const pref = await prisma.coachLearnedPreference.create({
      data: { coachId, topic: "sedute-brevi", insight: "Preferisce sedute più brevi.", category: "DURATION" },
    });

    await confirmCoachPreference(pref.id, coachId);
    const updated = await prisma.coachLearnedPreference.findUniqueOrThrow({ where: { id: pref.id } });
    expect(updated.reviewState).toBe("CONFIRMED");
  });

  it("rejecting a preference keeps the row but excludes it from the prompt, and can be reactivated", async () => {
    sportId = "";
    const coach = await createTestCoach();
    coachId = coach.id;
    const pref = await prisma.coachLearnedPreference.create({
      data: { coachId, topic: "ipotesi-sbagliata", insight: "Ipotesi non corretta.", category: "OTHER" },
    });

    await rejectCoachPreference(pref.id, coachId);
    let promptText = await getCoachBrainPromptText(coachId);
    expect(promptText).toBeNull();

    const rejected = await prisma.coachLearnedPreference.findUniqueOrThrow({ where: { id: pref.id } });
    expect(rejected.reviewState).toBe("REJECTED"); // kept, not deleted

    await reactivateCoachPreference(pref.id, coachId);
    promptText = await getCoachBrainPromptText(coachId);
    expect(promptText).toContain("Ipotesi non corretta.");
  });

  it("never leaks a preference across coaches", async () => {
    sportId = "";
    const coachA = await createTestCoach();
    coachId = coachA.id;
    const coachB = await createTestCoach();

    const pref = await prisma.coachLearnedPreference.create({
      data: { coachId: coachA.id, topic: "solo-di-a", insight: "Solo di A.", category: "OTHER" },
    });

    await confirmCoachPreference(pref.id, coachB.id); // wrong coach — must no-op
    const unchanged = await prisma.coachLearnedPreference.findUniqueOrThrow({ where: { id: pref.id } });
    expect(unchanged.reviewState).toBe("ACTIVE");

    const forB = await getCoachLearnedPreferences(coachB.id);
    expect(forB).toHaveLength(0);

    await deleteTestCoach(coachB.id);
  });

  it("hedges ACTIVE preferences and states CONFIRMED ones as settled", async () => {
    sportId = "";
    const coach = await createTestCoach();
    coachId = coach.id;
    await prisma.coachLearnedPreference.create({
      data: { coachId, topic: "attivo", insight: "Pattern attivo.", category: "OTHER", evidenceCount: 2 },
    });
    await prisma.coachLearnedPreference.create({
      data: { coachId, topic: "confermato", insight: "Pattern confermato.", category: "OTHER", evidenceCount: 4, reviewState: "CONFIRMED" },
    });

    const text = await getCoachBrainPromptText(coachId);
    expect(text).toContain("Pattern attivo. (pattern osservato, non confermato)");
    expect(text).toContain("Pattern confermato. (confermato dal coach)");
  });

  it("returns null when there are no usable preferences yet — never fabricated", async () => {
    sportId = "";
    const coach = await createTestCoach();
    coachId = coach.id;
    const text = await getCoachBrainPromptText(coachId);
    expect(text).toBeNull();
  });
});
