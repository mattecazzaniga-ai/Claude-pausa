import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { createTestCoach, createTestSport, createTestAthlete, deleteTestCoach, deleteTestSport } from "../helpers/db";
import { getAthleteDigitalTwin } from "@/lib/digital-twin";
import { saveMethodologyVersion } from "@/lib/methodology";

describe("getAthleteDigitalTwin", () => {
  let coachId: string;
  let sportId: string;

  afterEach(async () => {
    if (coachId) await deleteTestCoach(coachId);
    if (sportId) await deleteTestSport(sportId);
  });

  it("returns a coherent empty-state snapshot for a brand-new athlete", async () => {
    const coach = await createTestCoach();
    coachId = coach.id;
    const sport = await createTestSport();
    sportId = sport.id;
    const athlete = await createTestAthlete(coachId, sportId, { name: "Atleta Nuovo" });

    const twin = await getAthleteDigitalTwin(athlete.id);

    expect(twin.name).toBe("Atleta Nuovo");
    expect(twin.sportName).toBe(sport.name);
    expect(twin.overallInjuryStatus).toBe("NONE");
    expect(twin.aiSummary).toBeNull();
    expect(twin.baseline).toHaveLength(0);
    expect(twin.evaluationComparison).toHaveLength(0);
    expect(twin.activeObjectives).toHaveLength(0);
    expect(twin.methodology.version).toBeNull();
    expect(twin.methodology.principleCount).toBe(0);
  });

  it("surfaces the coach's methodology status once one is declared", async () => {
    const coach = await createTestCoach();
    coachId = coach.id;
    const sport = await createTestSport();
    sportId = sport.id;
    const athlete = await createTestAthlete(coachId, sportId);
    await saveMethodologyVersion(coachId, [
      { text: "Non aumento volume e intensità insieme", category: "VOLUME" },
      { text: "Preferisco la qualità al volume", category: "FILOSOFIA" },
    ]);

    const twin = await getAthleteDigitalTwin(athlete.id);
    expect(twin.methodology.version).toBe(1);
    expect(twin.methodology.principleCount).toBe(2);
  });

  it("reflects an active injury in the overall status, sourced from the same data /diagnose and session generation already use", async () => {
    const coach = await createTestCoach();
    coachId = coach.id;
    const sport = await createTestSport();
    sportId = sport.id;
    const athlete = await createTestAthlete(coachId, sportId);
    await prisma.athleteInjury.create({
      data: { athleteId: athlete.id, coachId, type: "INFORTUNIO", bodyRegion: "Ginocchio", status: "ACTIVE" },
    });

    const twin = await getAthleteDigitalTwin(athlete.id);
    expect(twin.overallInjuryStatus).toBe("ACTIVE_INJURY");
    expect(twin.activeInjuries).toHaveLength(1);
  });

  it("includes per-metric baseline once values are recorded, without duplicating the Smart Metrics Engine's own storage", async () => {
    const coach = await createTestCoach();
    coachId = coach.id;
    const sport = await createTestSport();
    sportId = sport.id;
    const athlete = await createTestAthlete(coachId, sportId);
    const metric = await prisma.sportMetric.create({ data: { sportId, name: "Tempo sui 5km", unit: "min", direction: "LOWER_IS_BETTER" } });
    await prisma.athleteMetricValue.create({ data: { athleteId: athlete.id, coachId, sportMetricId: metric.id, value: 22, recordedAt: new Date() } });

    const twin = await getAthleteDigitalTwin(athlete.id);
    expect(twin.baseline).toHaveLength(1);
    expect(twin.baseline[0].currentValue).toBe(22);
  });

  it("throws for a non-existent athlete rather than returning a fabricated empty twin", async () => {
    const coach = await createTestCoach();
    coachId = coach.id;
    const sport = await createTestSport();
    sportId = sport.id;
    await expect(getAthleteDigitalTwin("does-not-exist")).rejects.toThrow();
  });
});
