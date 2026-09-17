import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { createTestCoach, createTestSport, createTestAthlete, deleteTestCoach, deleteTestSport } from "../helpers/db";
import { getAthleteBaseline } from "@/lib/baseline";

describe("getAthleteBaseline", () => {
  let coachId: string;
  let sportId: string;

  afterEach(async () => {
    if (coachId) await deleteTestCoach(coachId);
    if (sportId) await deleteTestSport(sportId);
  });

  it("returns nothing for an athlete with no recorded metric values", async () => {
    const coach = await createTestCoach();
    coachId = coach.id;
    const sport = await createTestSport();
    sportId = sport.id;
    const athlete = await createTestAthlete(coachId, sportId);

    expect(await getAthleteBaseline(athlete.id)).toHaveLength(0);
  });

  it("tracks initial -> current from the earliest and latest recorded value", async () => {
    const coach = await createTestCoach();
    coachId = coach.id;
    const sport = await createTestSport();
    sportId = sport.id;
    const athlete = await createTestAthlete(coachId, sportId);
    const metric = await prisma.sportMetric.create({ data: { sportId, name: "Tempo sui 5km", unit: "min", direction: "LOWER_IS_BETTER" } });

    await prisma.athleteMetricValue.create({ data: { athleteId: athlete.id, coachId, sportMetricId: metric.id, value: 25, recordedAt: new Date("2024-01-01") } });
    await prisma.athleteMetricValue.create({ data: { athleteId: athlete.id, coachId, sportMetricId: metric.id, value: 22, recordedAt: new Date("2024-06-01") } });

    const baseline = await getAthleteBaseline(athlete.id);
    expect(baseline).toHaveLength(1);
    expect(baseline[0].initialValue).toBe(25);
    expect(baseline[0].currentValue).toBe(22);
  });

  it("a lower value is the personal best for a LOWER_IS_BETTER metric, never the highest", async () => {
    const coach = await createTestCoach();
    coachId = coach.id;
    const sport = await createTestSport();
    sportId = sport.id;
    const athlete = await createTestAthlete(coachId, sportId);
    const metric = await prisma.sportMetric.create({ data: { sportId, name: "Tempo sui 5km", unit: "min", direction: "LOWER_IS_BETTER" } });

    await prisma.athleteMetricValue.create({ data: { athleteId: athlete.id, coachId, sportMetricId: metric.id, value: 25, recordedAt: new Date("2024-01-01") } });
    await prisma.athleteMetricValue.create({ data: { athleteId: athlete.id, coachId, sportMetricId: metric.id, value: 20, recordedAt: new Date("2024-03-01") } });
    await prisma.athleteMetricValue.create({ data: { athleteId: athlete.id, coachId, sportMetricId: metric.id, value: 23, recordedAt: new Date("2024-06-01") } });

    const [baseline] = await getAthleteBaseline(athlete.id);
    expect(baseline.personalBest?.value).toBe(20);
  });

  it("a higher value is the personal best for a HIGHER_IS_BETTER metric", async () => {
    const coach = await createTestCoach();
    coachId = coach.id;
    const sport = await createTestSport();
    sportId = sport.id;
    const athlete = await createTestAthlete(coachId, sportId);
    const metric = await prisma.sportMetric.create({ data: { sportId, name: "Salto in alto", unit: "cm", direction: "HIGHER_IS_BETTER" } });

    await prisma.athleteMetricValue.create({ data: { athleteId: athlete.id, coachId, sportMetricId: metric.id, value: 180, recordedAt: new Date("2024-01-01") } });
    await prisma.athleteMetricValue.create({ data: { athleteId: athlete.id, coachId, sportMetricId: metric.id, value: 195, recordedAt: new Date("2024-03-01") } });
    await prisma.athleteMetricValue.create({ data: { athleteId: athlete.id, coachId, sportMetricId: metric.id, value: 190, recordedAt: new Date("2024-06-01") } });

    const [baseline] = await getAthleteBaseline(athlete.id);
    expect(baseline.personalBest?.value).toBe(195);
  });

  it("never invents a personal/season best when the metric's direction is unknown", async () => {
    const coach = await createTestCoach();
    coachId = coach.id;
    const sport = await createTestSport();
    sportId = sport.id;
    const athlete = await createTestAthlete(coachId, sportId);
    // No direction set — as for every SportMetric generated before this field existed.
    const metric = await prisma.sportMetric.create({ data: { sportId, name: "Metrica legacy", unit: null } });

    await prisma.athleteMetricValue.create({ data: { athleteId: athlete.id, coachId, sportMetricId: metric.id, value: 10, recordedAt: new Date("2024-01-01") } });
    await prisma.athleteMetricValue.create({ data: { athleteId: athlete.id, coachId, sportMetricId: metric.id, value: 20, recordedAt: new Date("2024-06-01") } });

    const [baseline] = await getAthleteBaseline(athlete.id);
    expect(baseline.direction).toBeNull();
    expect(baseline.personalBest).toBeNull();
    expect(baseline.seasonBest).toBeNull();
    // Initial/current still work — those are the actual recorded values, no direction needed.
    expect(baseline.initialValue).toBe(10);
    expect(baseline.currentValue).toBe(20);
  });

  it("season best only looks at values recorded in the current calendar year", async () => {
    const coach = await createTestCoach();
    coachId = coach.id;
    const sport = await createTestSport();
    sportId = sport.id;
    const athlete = await createTestAthlete(coachId, sportId);
    const metric = await prisma.sportMetric.create({ data: { sportId, name: "Salto in lungo", unit: "cm", direction: "HIGHER_IS_BETTER" } });

    const currentYear = new Date().getFullYear();
    await prisma.athleteMetricValue.create({ data: { athleteId: athlete.id, coachId, sportMetricId: metric.id, value: 500, recordedAt: new Date(currentYear - 1, 5, 1) } }); // last year's PB
    await prisma.athleteMetricValue.create({ data: { athleteId: athlete.id, coachId, sportMetricId: metric.id, value: 470, recordedAt: new Date(currentYear, 2, 1) } });
    await prisma.athleteMetricValue.create({ data: { athleteId: athlete.id, coachId, sportMetricId: metric.id, value: 480, recordedAt: new Date(currentYear, 5, 1) } });

    const [baseline] = await getAthleteBaseline(athlete.id);
    expect(baseline.personalBest?.value).toBe(500); // all-time, includes last year
    expect(baseline.seasonBest?.value).toBe(480); // this year only
  });
});
