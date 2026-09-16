import { describe, it, expect } from "vitest";
import { summarizeMetricValues } from "@/lib/intelligence/context";

describe("summarizeMetricValues", () => {
  it("returns the latest value with a down trend when the number decreased", () => {
    const result = summarizeMetricValues([
      { value: 3.1, recordedAt: new Date("2026-09-10"), sportMetric: { name: "Velocità 20m", unit: "s" } },
      { value: 3.4, recordedAt: new Date("2026-09-01"), sportMetric: { name: "Velocità 20m", unit: "s" } },
    ]);
    expect(result).toEqual([{ name: "Velocità 20m", unit: "s", latestValue: 3.1, latestDate: new Date("2026-09-10").toISOString(), trend: "down" }]);
  });

  it("returns trend null with a single data point", () => {
    const result = summarizeMetricValues([{ value: 10, recordedAt: new Date("2026-09-10"), sportMetric: { name: "Passi", unit: null } }]);
    expect(result[0].trend).toBeNull();
  });

  it("groups multiple metrics independently, each keyed by its own most recent pair", () => {
    const result = summarizeMetricValues([
      { value: 5, recordedAt: new Date("2026-09-10"), sportMetric: { name: "A", unit: null } },
      { value: 4, recordedAt: new Date("2026-09-01"), sportMetric: { name: "A", unit: null } },
      { value: 100, recordedAt: new Date("2026-09-05"), sportMetric: { name: "B", unit: "m" } },
    ]);
    const byName = Object.fromEntries(result.map((r) => [r.name, r]));
    expect(byName.A).toMatchObject({ latestValue: 5, trend: "up" });
    expect(byName.B).toMatchObject({ latestValue: 100, trend: null });
  });

  it("returns flat when the two most recent values are equal", () => {
    const result = summarizeMetricValues([
      { value: 7, recordedAt: new Date("2026-09-10"), sportMetric: { name: "X", unit: null } },
      { value: 7, recordedAt: new Date("2026-09-01"), sportMetric: { name: "X", unit: null } },
    ]);
    expect(result[0].trend).toBe("flat");
  });
});
