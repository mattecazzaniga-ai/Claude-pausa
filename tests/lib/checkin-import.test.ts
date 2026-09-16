import { describe, it, expect } from "vitest";
import { parseCheckinCsv } from "@/lib/checkin-import";

describe("parseCheckinCsv", () => {
  it("parses a valid CSV with the full column set", () => {
    const csv = [
      "date,readiness,rpe,feeling,sleepHours,soreness,restingHeartRate,hrv,steps,notes",
      "2026-09-01,8,5,GOOD,7.5,3,52,65,8500,tutto bene",
      "2026-09-02,6,7,OK,6,5,55,60,6000,",
    ].join("\n");

    const { rows, errors } = parseCheckinCsv(csv);
    expect(errors).toHaveLength(0);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ readiness: 8, rpe: 5, feeling: "GOOD", sleepHours: 7.5, soreness: 3, restingHeartRate: 52, hrv: 65, steps: 8500, notes: "tutto bene" });
    expect(rows[1].notes).toBeNull();
  });

  it("recognizes Italian column aliases", () => {
    const csv = ["data,prontezza,sforzo,sonno,indolenzimento,passi", "2026-09-01,7,4,8,2,5000"].join("\n");
    const { rows, errors } = parseCheckinCsv(csv);
    expect(errors).toHaveLength(0);
    expect(rows[0]).toMatchObject({ readiness: 7, rpe: 4, sleepHours: 8, soreness: 2, steps: 5000 });
  });

  it("rejects a file with no date column", () => {
    const csv = ["readiness,rpe", "8,5"].join("\n");
    const { rows, errors } = parseCheckinCsv(csv);
    expect(rows).toHaveLength(0);
    expect(errors[0]).toContain("date");
  });

  it("skips a row with an invalid date but keeps parsing the rest", () => {
    const csv = ["date,readiness", "not-a-date,8", "2026-09-01,6"].join("\n");
    const { rows, errors } = parseCheckinCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].readiness).toBe(6);
    expect(errors.some((e) => e.includes("data"))).toBe(true);
  });

  it("skips a row with an out-of-range value", () => {
    const csv = ["date,readiness", "2026-09-01,55"].join("\n");
    const { rows, errors } = parseCheckinCsv(csv);
    expect(rows).toHaveLength(0);
    expect(errors[0]).toContain("readiness");
  });

  it("skips a row with an invalid feeling value", () => {
    const csv = ["date,feeling", "2026-09-01,ECSTATIC"].join("\n");
    const { rows, errors } = parseCheckinCsv(csv);
    expect(rows).toHaveLength(0);
    expect(errors[0]).toContain("feeling");
  });

  it("skips a row with only a date and no other data", () => {
    const csv = ["date,readiness", "2026-09-01,"].join("\n");
    const { rows, errors } = parseCheckinCsv(csv);
    expect(rows).toHaveLength(0);
    expect(errors[0]).toContain("ignorata");
  });

  it("returns an error for an empty file", () => {
    const { rows, errors } = parseCheckinCsv("");
    expect(rows).toHaveLength(0);
    expect(errors).toHaveLength(1);
  });
});
