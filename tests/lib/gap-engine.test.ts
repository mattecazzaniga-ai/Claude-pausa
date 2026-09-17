import { describe, it, expect } from "vitest";
import { computeMainGap } from "@/lib/intelligence/gap-engine";
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
    relevantMemories: [],
    ...overrides,
  };
}

// GEMINI_API_KEY is unset in the test environment — see performance-level.test.ts
// for why these tests only exercise the deterministic short-circuit.
describe("computeMainGap", () => {
  it("reports hasEnoughData=false without calling the AI when there are no active objectives", async () => {
    const result = await computeMainGap(emptyContext());
    expect(result.hasEnoughData).toBe(false);
    expect(result.objectiveTitle).toBeNull();
  });

  it("ignores a qualitative objective — it has no measurable gap", async () => {
    const context = emptyContext({
      activeObjectives: [{ title: "Migliorare la leadership in campo", termLength: "LONG", kind: "QUALITATIVE", baselineValue: null, targetValue: null, currentValue: null, unit: null }],
    });
    const result = await computeMainGap(context);
    expect(result.hasEnoughData).toBe(false);
  });

  it("ignores a quantitative objective missing either a current or a target value", async () => {
    const context = emptyContext({
      activeObjectives: [{ title: "Sub 20' sui 5km", termLength: "MEDIUM", kind: "QUANTITATIVE", baselineValue: "25", targetValue: "20", currentValue: null, unit: "min" }],
    });
    const result = await computeMainGap(context);
    expect(result.hasEnoughData).toBe(false);
  });

  it("attempts a real gap computation (and thus needs the AI) once a quantitative objective has both current and target", async () => {
    const context = emptyContext({
      activeObjectives: [{ title: "Sub 20' sui 5km", termLength: "MEDIUM", kind: "QUANTITATIVE", baselineValue: "25", targetValue: "20", currentValue: "22", unit: "min" }],
    });
    await expect(computeMainGap(context)).rejects.toThrow("AI not configured");
  });
});
