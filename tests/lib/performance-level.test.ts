import { describe, it, expect } from "vitest";
import { assessPerformanceLevel } from "@/lib/intelligence/performance-level";
import type { IntelligenceContext } from "@/lib/intelligence/context";

function emptyContext(overrides: Partial<IntelligenceContext> = {}): IntelligenceContext {
  return {
    subjectName: "Atleta di prova",
    sportName: "Sport di prova",
    sportContextText: "Sport: Sport di prova",
    objectivesFreeText: null,
    aiSummary: null,
    aiPriorities: [],
    recentNotes: [],
    evaluationComparison: [],
    daysSinceLastEvaluation: null,
    activeObjectives: [],
    recentCompetitions: [],
    upcomingCompetition: null,
    recentSessions: [],
    daysSinceLastSession: null,
    recentCheckins: [],
    recentMetrics: [],
    activeInjuries: [],
    ...overrides,
  };
}

// GEMINI_API_KEY is unset in the test environment (see .env / vitest.config.ts),
// so any path that would need the AI throws instead of silently succeeding —
// these tests only exercise the deterministic short-circuit, which must never
// reach the AI when there isn't enough real evidence (master prompt §28: "a
// level is never invented without sufficient data").
describe("assessPerformanceLevel", () => {
  it("returns INSUFFICIENT_DATA without calling the AI when there is no evidence at all", async () => {
    const result = await assessPerformanceLevel(emptyContext());
    expect(result.provenance).toBe("INSUFFICIENT_DATA");
    expect(result.level).toBeNull();
    expect(result.basedOn).toHaveLength(0);
  });

  it("attempts a real assessment (and thus needs the AI) once evaluations exist", async () => {
    const context = emptyContext({
      evaluationComparison: [{ criterionId: "c1", category: "Tecnica", name: "Precisione", scoreType: "SCALE_1_10", baseline: "5", previous: "6", current: "7" }],
    });
    await expect(assessPerformanceLevel(context)).rejects.toThrow("AI not configured");
  });

  it("attempts a real assessment once sport metrics have been recorded", async () => {
    const context = emptyContext({
      recentMetrics: [{ name: "Tempo sui 5km", unit: "min", latestValue: 22, latestDate: new Date().toISOString(), trend: "down" }],
    });
    await expect(assessPerformanceLevel(context)).rejects.toThrow("AI not configured");
  });

  it("attempts a real assessment once a quantitative objective has a current value", async () => {
    const context = emptyContext({
      activeObjectives: [{ title: "Sub 20' sui 5km", termLength: "MEDIUM", kind: "QUANTITATIVE", baselineValue: "25", targetValue: "20", currentValue: "22", unit: "min" }],
    });
    await expect(assessPerformanceLevel(context)).rejects.toThrow("AI not configured");
  });

  it("does not treat a qualitative objective with no current value as evidence", async () => {
    const context = emptyContext({
      activeObjectives: [{ title: "Migliorare la concentrazione", termLength: "LONG", kind: "QUALITATIVE", baselineValue: null, targetValue: null, currentValue: null, unit: null }],
    });
    const result = await assessPerformanceLevel(context);
    expect(result.provenance).toBe("INSUFFICIENT_DATA");
  });
});
