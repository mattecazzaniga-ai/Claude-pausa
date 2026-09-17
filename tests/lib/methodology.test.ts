import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { createTestCoach, deleteTestCoach } from "../helpers/db";
import { saveMethodologyVersion, getMethodologyPrinciples, getCurrentMethodologyVersion, formatMethodologyForPrompt, getMethodologyPromptText } from "@/lib/methodology";

describe("methodology versioning", () => {
  let coachId: string;

  afterEach(async () => {
    if (coachId) await deleteTestCoach(coachId);
  });

  it("starts with no version and no principles", async () => {
    const coach = await createTestCoach();
    coachId = coach.id;

    expect(await getCurrentMethodologyVersion(coachId)).toBeNull();
    expect(await getMethodologyPrinciples(coachId)).toHaveLength(0);
    expect(await getMethodologyPromptText(coachId)).toBeNull();
  });

  it("creates version 1 on first save and persists the live principles", async () => {
    const coach = await createTestCoach();
    coachId = coach.id;

    const version = await saveMethodologyVersion(coachId, [{ text: "Preferisco la qualità al volume", category: "FILOSOFIA" }]);
    expect(version).toBe(1);

    const principles = await getMethodologyPrinciples(coachId);
    expect(principles).toHaveLength(1);
    expect(principles[0].text).toBe("Preferisco la qualità al volume");
  });

  it("increments the version on every subsequent save without erasing history", async () => {
    const coach = await createTestCoach();
    coachId = coach.id;

    await saveMethodologyVersion(coachId, [{ text: "Principio A", category: "VOLUME" }]);
    const v2 = await saveMethodologyVersion(coachId, [
      { text: "Principio A", category: "VOLUME" },
      { text: "Principio B", category: "RECUPERO" },
    ]);
    expect(v2).toBe(2);

    const history = await prisma.coachMethodologyVersion.findMany({ where: { coachId }, orderBy: { version: "asc" } });
    expect(history).toHaveLength(2);
    expect((history[0].principles as { text: string }[]).map((p) => p.text)).toEqual(["Principio A"]);
    expect((history[1].principles as { text: string }[]).map((p) => p.text)).toEqual(["Principio A", "Principio B"]);
  });

  it("a later version never rewrites an earlier snapshot (past plans stay traceable)", async () => {
    const coach = await createTestCoach();
    coachId = coach.id;

    await saveMethodologyVersion(coachId, [{ text: "Solo qualità", category: "FILOSOFIA" }], "Versione iniziale");
    await saveMethodologyVersion(coachId, [{ text: "Qualità e volume bilanciati", category: "FILOSOFIA" }], "Rivista dopo stagione");

    const v1 = await prisma.coachMethodologyVersion.findUnique({ where: { coachId_version: { coachId, version: 1 } } });
    expect((v1?.principles as { text: string }[])[0].text).toBe("Solo qualità");
  });

  it("replacing the live set drops principles no longer submitted (delete-by-omission)", async () => {
    const coach = await createTestCoach();
    coachId = coach.id;

    await saveMethodologyVersion(coachId, [
      { text: "Principio A", category: "VOLUME" },
      { text: "Principio B", category: "RECUPERO" },
    ]);
    await saveMethodologyVersion(coachId, [{ text: "Principio A", category: "VOLUME" }]);

    const live = await getMethodologyPrinciples(coachId);
    expect(live.map((p) => p.text)).toEqual(["Principio A"]);
  });

  it("auto-computes a diff-based change summary when none is given", async () => {
    const coach = await createTestCoach();
    coachId = coach.id;

    await saveMethodologyVersion(coachId, [{ text: "Principio A", category: "VOLUME" }]);
    await saveMethodologyVersion(coachId, [
      { text: "Principio A", category: "VOLUME" },
      { text: "Principio B", category: "RECUPERO" },
    ]);

    const v2 = await prisma.coachMethodologyVersion.findUnique({ where: { coachId_version: { coachId, version: 2 } } });
    expect(v2?.changeSummary).toContain("+1");
  });
});

describe("formatMethodologyForPrompt", () => {
  it("returns null for an empty list", () => {
    expect(formatMethodologyForPrompt([])).toBeNull();
  });

  it("labels the block as coach-authored, not an observation", () => {
    const text = formatMethodologyForPrompt([{ text: "Non aumento volume e intensità insieme", category: "VOLUME" }]);
    expect(text).toContain("METODOLOGIA DICHIARATA DA QUESTO ALLENATORE");
    expect(text).toContain("Non aumento volume e intensità insieme");
    expect(text).toContain("[Volume]");
  });
});
