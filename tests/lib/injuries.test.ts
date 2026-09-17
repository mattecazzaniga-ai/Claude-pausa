import { describe, it, expect } from "vitest";
import { computeOverallInjuryStatus, formatInjuriesForPrompt, formatInjuryAdaptationNote } from "@/lib/injuries";

describe("computeOverallInjuryStatus", () => {
  it("returns NONE when there are no injuries", () => {
    expect(computeOverallInjuryStatus([])).toBe("NONE");
  });

  it("returns NONE when all injuries are resolved or archived", () => {
    expect(computeOverallInjuryStatus([{ type: "INFORTUNIO", status: "RESOLVED" }, { type: "FASTIDIO", status: "ARCHIVED" }])).toBe("NONE");
  });

  it("returns ACTIVE_INJURY when an active INFORTUNIO exists, even alongside milder ones", () => {
    expect(
      computeOverallInjuryStatus([
        { type: "FASTIDIO", status: "MONITORING" },
        { type: "INFORTUNIO", status: "ACTIVE" },
      ])
    ).toBe("ACTIVE_INJURY");
  });

  it("returns PARTIAL for an active LIMITAZIONE with no active INFORTUNIO", () => {
    expect(computeOverallInjuryStatus([{ type: "LIMITAZIONE", status: "ACTIVE" }])).toBe("PARTIAL");
  });

  it("returns MONITORED for a monitored FASTIDIO with nothing worse", () => {
    expect(computeOverallInjuryStatus([{ type: "FASTIDIO", status: "MONITORING" }])).toBe("MONITORED");
  });

  it("does not let a RESOLVED INFORTUNIO force ACTIVE_INJURY", () => {
    expect(computeOverallInjuryStatus([{ type: "INFORTUNIO", status: "RESOLVED" }, { type: "FASTIDIO", status: "MONITORING" }])).toBe("MONITORED");
  });
});

describe("formatInjuriesForPrompt", () => {
  it("returns null for an empty list", () => {
    expect(formatInjuriesForPrompt([])).toBeNull();
  });

  it("frames the data as reported, never as a diagnosis", () => {
    const text = formatInjuriesForPrompt([
      { type: "FASTIDIO", bodyRegion: "Spalla", side: "RIGHT", areaDetail: null, status: "MONITORING", startDate: new Date(), reportedLimitations: "evitare overhead" },
    ]);
    expect(text).toContain("NON diagnosi mediche");
    expect(text).toContain("Spalla");
    expect(text).toContain("lato destro");
    expect(text).toContain("evitare overhead");
  });

  it("omits the side clause when not applicable", () => {
    const text = formatInjuriesForPrompt([
      { type: "INFORTUNIO", bodyRegion: "Schiena bassa", side: "NOT_APPLICABLE", areaDetail: null, status: "ACTIVE", startDate: new Date(), reportedLimitations: null },
    ]);
    expect(text).not.toContain("lato");
  });
});

describe("formatInjuryAdaptationNote", () => {
  it("lists every affected area", () => {
    const note = formatInjuryAdaptationNote([
      { type: "FASTIDIO", bodyRegion: "Spalla", side: "RIGHT", areaDetail: null, status: "MONITORING", startDate: new Date(), reportedLimitations: null },
      { type: "LIMITAZIONE", bodyRegion: "Ginocchio", side: "LEFT", areaDetail: null, status: "ACTIVE", startDate: new Date(), reportedLimitations: null },
    ]);
    expect(note).toContain("Spalla");
    expect(note).toContain("Ginocchio");
  });
});
