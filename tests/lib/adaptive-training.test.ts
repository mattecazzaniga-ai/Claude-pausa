import { describe, it, expect } from "vitest";
import { computeAdaptationSignal, formatAdaptationDirective, formatAdaptationNote } from "@/lib/adaptive-training";

const NOW = new Date("2026-09-16T12:00:00.000Z");

function hoursAgo(h: number): Date {
  return new Date(NOW.getTime() - h * 60 * 60 * 1000);
}

function daysAgo(d: number): Date {
  return new Date(NOW.getTime() - d * 24 * 60 * 60 * 1000);
}

describe("computeAdaptationSignal", () => {
  it("returns null when there is no checkin and no recent session feedback", () => {
    const signal = computeAdaptationSignal({ latestCheckin: null, recentSessions: [] }, NOW);
    expect(signal).toBeNull();
  });

  it("returns null for a middling recent checkin (no threshold crossed)", () => {
    const signal = computeAdaptationSignal(
      { latestCheckin: { date: hoursAgo(2), readiness: 6, rpe: 5, soreness: 4, sleepHours: 7 }, recentSessions: [] },
      NOW
    );
    expect(signal).toBeNull();
  });

  it("flags REDUCE for low readiness", () => {
    const signal = computeAdaptationSignal(
      { latestCheckin: { date: hoursAgo(2), readiness: 3, rpe: null, soreness: null, sleepHours: null }, recentSessions: [] },
      NOW
    );
    expect(signal?.level).toBe("REDUCE");
    expect(signal?.reasons[0]).toContain("prontezza bassa");
  });

  it("flags REDUCE for high soreness", () => {
    const signal = computeAdaptationSignal(
      { latestCheckin: { date: hoursAgo(2), readiness: null, rpe: null, soreness: 9, sleepHours: null }, recentSessions: [] },
      NOW
    );
    expect(signal?.level).toBe("REDUCE");
    expect(signal?.reasons.join(" ")).toContain("indolenzimento");
  });

  it("flags REDUCE for very poor sleep", () => {
    const signal = computeAdaptationSignal(
      { latestCheckin: { date: hoursAgo(2), readiness: null, rpe: null, soreness: null, sleepHours: 4 }, recentSessions: [] },
      NOW
    );
    expect(signal?.level).toBe("REDUCE");
    expect(signal?.reasons.join(" ")).toContain("sonno");
  });

  it("ignores a checkin older than the recency window", () => {
    const signal = computeAdaptationSignal(
      { latestCheckin: { date: hoursAgo(72), readiness: 2, rpe: null, soreness: null, sleepHours: null }, recentSessions: [] },
      NOW
    );
    expect(signal).toBeNull();
  });

  it("flags INCREASE when readiness is very high with no soreness/high effort", () => {
    const signal = computeAdaptationSignal(
      { latestCheckin: { date: hoursAgo(2), readiness: 10, rpe: 3, soreness: 1, sleepHours: 8 }, recentSessions: [] },
      NOW
    );
    expect(signal?.level).toBe("INCREASE");
  });

  it("flags REDUCE when the last 2 sessions were both rated NEEDS_WORK", () => {
    const signal = computeAdaptationSignal(
      {
        latestCheckin: null,
        recentSessions: [
          { createdAt: daysAgo(1), feedbackRating: "NEEDS_WORK" },
          { createdAt: daysAgo(3), feedbackRating: "NEEDS_WORK" },
        ],
      },
      NOW
    );
    expect(signal?.level).toBe("REDUCE");
  });

  it("ignores stale session feedback outside the recency window", () => {
    const signal = computeAdaptationSignal(
      {
        latestCheckin: null,
        recentSessions: [
          { createdAt: daysAgo(30), feedbackRating: "NEEDS_WORK" },
          { createdAt: daysAgo(35), feedbackRating: "NEEDS_WORK" },
        ],
      },
      NOW
    );
    expect(signal).toBeNull();
  });

  it("a single NEEDS_WORK session is not enough on its own", () => {
    const signal = computeAdaptationSignal(
      {
        latestCheckin: null,
        recentSessions: [
          { createdAt: daysAgo(1), feedbackRating: "NEEDS_WORK" },
          { createdAt: daysAgo(3), feedbackRating: "GOOD" },
        ],
      },
      NOW
    );
    expect(signal).toBeNull();
  });

  it("REDUCE takes priority over an otherwise-qualifying INCREASE", () => {
    const signal = computeAdaptationSignal(
      { latestCheckin: { date: hoursAgo(2), readiness: 9, rpe: 9, soreness: 1, sleepHours: 8 }, recentSessions: [] },
      NOW
    );
    expect(signal?.level).toBe("REDUCE");
  });
});

describe("formatAdaptationDirective / formatAdaptationNote", () => {
  it("cites the real reasons for a REDUCE signal", () => {
    const signal = { level: "REDUCE" as const, reasons: ["prontezza bassa (3/10)"] };
    expect(formatAdaptationDirective(signal)).toContain("prontezza bassa (3/10)");
    expect(formatAdaptationDirective(signal)).toContain("riduci il carico");
    expect(formatAdaptationNote(signal)).toContain("Carico ridotto");
  });

  it("cites the real reasons for an INCREASE signal", () => {
    const signal = { level: "INCREASE" as const, reasons: ["prontezza molto alta (10/10)"] };
    expect(formatAdaptationDirective(signal)).toContain("prontezza molto alta (10/10)");
    expect(formatAdaptationNote(signal)).toContain("Carico aumentato");
  });
});
