import { describe, expect, it } from "vitest";
import { computeTrainingLoad, getDisciplineCoefficient, getZoneMultiplier } from "@/lib/training-load";

describe("getDisciplineCoefficient", () => {
  it("recognizes running as higher-impact than cycling and swimming", () => {
    const running = getDisciplineCoefficient("Corsa");
    const cycling = getDisciplineCoefficient("Ciclismo");
    const swimming = getDisciplineCoefficient("Nuoto");
    expect(running).toBeGreaterThan(cycling);
    expect(running).toBeGreaterThan(swimming);
  });

  it("matches case-insensitively and across accents/synonyms", () => {
    expect(getDisciplineCoefficient("CORSA")).toBe(getDisciplineCoefficient("running"));
    expect(getDisciplineCoefficient("bici")).toBe(getDisciplineCoefficient("Ciclismo"));
  });

  it("falls back to the neutral 1x coefficient for an unrecognized discipline", () => {
    expect(getDisciplineCoefficient("Calcio")).toBe(1);
    expect(getDisciplineCoefficient("")).toBe(1);
  });

  it("matches a discipline embedded in a longer phrase by whole word", () => {
    expect(getDisciplineCoefficient("corsa leggera")).toBe(getDisciplineCoefficient("corsa"));
  });
});

describe("getZoneMultiplier", () => {
  it("increases monotonically from warmup to race", () => {
    const order = ["WARMUP", "EASY", "MODERATE", "HARD", "RACE"] as const;
    const values = order.map(getZoneMultiplier);
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThan(values[i - 1]);
    }
  });
});

describe("computeTrainingLoad", () => {
  it("matches the coach's own worked example: 60min run at RPE 5, moderate zone", () => {
    const load = computeTrainingLoad({ durationMinutes: 60, rpe: 5, discipline: "Corsa", zone: "MODERATE" });
    // 60 * 5 * 1.1 (corsa) * 1 (moderate) = 330
    expect(load).toBe(330);
  });

  it("gives a lower load for the same duration/RPE on a lower-impact discipline", () => {
    const running = computeTrainingLoad({ durationMinutes: 60, rpe: 5, discipline: "Corsa", zone: "MODERATE" });
    const swimming = computeTrainingLoad({ durationMinutes: 60, rpe: 5, discipline: "Nuoto", zone: "MODERATE" });
    expect(swimming).toBeLessThan(running);
  });

  it("weighs a warmup lower and a race higher than a moderate session, all else equal", () => {
    const warmup = computeTrainingLoad({ durationMinutes: 30, rpe: 4, discipline: "Corsa", zone: "WARMUP" });
    const moderate = computeTrainingLoad({ durationMinutes: 30, rpe: 4, discipline: "Corsa", zone: "MODERATE" });
    const race = computeTrainingLoad({ durationMinutes: 30, rpe: 4, discipline: "Corsa", zone: "RACE" });
    expect(warmup).toBeLessThan(moderate);
    expect(race).toBeGreaterThan(moderate);
  });

  it("returns zero load for zero RPE (no effort perceived)", () => {
    expect(computeTrainingLoad({ durationMinutes: 45, rpe: 0, discipline: "Corsa", zone: "MODERATE" })).toBe(0);
  });
});
