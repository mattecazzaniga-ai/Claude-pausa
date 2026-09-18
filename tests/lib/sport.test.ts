import { describe, it, expect, vi, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { createTestSport, deleteTestSport, createTestCoach, deleteTestCoach } from "../helpers/db";

vi.mock("@/lib/ai", () => ({ isAiConfigured: true }));

vi.mock("@/lib/ai-sport-profile", () => ({
  generateSportProfile: vi.fn().mockResolvedValue({
    formats: ["INDIVIDUAL"],
    environment: "Campo di prova",
    equipment: "Attrezzo di prova",
    scoringSystem: "Punteggio di prova",
    keyRules: "Regola di prova",
    terminology: "Termine di prova",
    positions: "Ruolo di prova",
    movementPatterns: "Pattern di prova",
    gameSituations: "Situazione di prova",
    trainingMethods: "Metodo di prova",
    commonProblems: "Problema di prova",
    progressions: "Progressione di prova",
    safetyNotes: "Nota di sicurezza di prova",
    disciplines: [],
  }),
}));

vi.mock("@/lib/ai-sport-metrics", () => ({
  generateSportMetrics: vi.fn().mockResolvedValue({
    metrics: [{ name: "Metrica di prova", unit: "unità", description: "Descrizione di prova", direction: "HIGHER_IS_BETTER" }],
  }),
}));

vi.mock("@/lib/ai-taxonomy", () => ({
  generateSportTaxonomy: vi.fn().mockResolvedValue({
    categories: [{ name: "Categoria di prova", type: "TECHNICAL", skills: ["Skill A", "Skill B"] }],
  }),
}));

describe("Sport Intelligence Phase 1", () => {
  let sportId: string;

  afterEach(async () => {
    if (sportId) await deleteTestSport(sportId);
  });

  it("ensureSportProfile persists the full profile including the new fields", async () => {
    const sport = await createTestSport();
    sportId = sport.id;

    const { ensureSportProfile, getSportProfile } = await import("@/lib/sport");
    await ensureSportProfile(sportId);

    const profile = await getSportProfile(sportId);
    expect(profile.positions).toBe("Ruolo di prova");
    expect(profile.movementPatterns).toBe("Pattern di prova");
    expect(profile.gameSituations).toBe("Situazione di prova");
    expect(profile.trainingMethods).toBe("Metodo di prova");
    expect(profile.commonProblems).toBe("Problema di prova");
    expect(profile.progressions).toBe("Progressione di prova");
    expect(profile.safetyNotes).toBe("Nota di sicurezza di prova");
    expect(profile.disciplines).toEqual([]);
  });

  it("ensureSportMetrics persists sport-specific metrics", async () => {
    const sport = await createTestSport();
    sportId = sport.id;
    const coach = await createTestCoach();

    const { getSportMetrics } = await import("@/lib/sport");
    const metrics = await getSportMetrics(sportId, coach.id);
    expect(metrics).toHaveLength(1);
    expect(metrics[0]).toMatchObject({ name: "Metrica di prova", unit: "unità", description: "Descrizione di prova" });

    await deleteTestCoach(coach.id);
  });

  it("a coach's own custom metric survives a shared-set regeneration by another coach", async () => {
    const sport = await createTestSport();
    sportId = sport.id;
    const coach = await createTestCoach();

    const { ensureSportMetrics, getSportMetrics } = await import("@/lib/sport");
    await ensureSportMetrics(sportId); // creates the shared (coachId: null) set

    await prisma.sportMetric.create({
      data: { sportId, coachId: coach.id, name: "Tempo sui 40km", unit: "min", direction: "LOWER_IS_BETTER", order: 99 },
    });

    await ensureSportMetrics(sportId, { force: true }); // simulates another coach regenerating the shared profile

    const metrics = await getSportMetrics(sportId, coach.id);
    expect(metrics.map((m) => m.name)).toContain("Tempo sui 40km");

    await deleteTestCoach(coach.id);
  });

  it("regenerateSportProfile overwrites the profile and refreshes metrics", async () => {
    const sport = await createTestSport();
    sportId = sport.id;

    const { ensureSportProfile, regenerateSportProfile } = await import("@/lib/sport");
    await ensureSportProfile(sportId);

    const { generateSportProfile } = await import("@/lib/ai-sport-profile");
    vi.mocked(generateSportProfile).mockResolvedValueOnce({
      formats: ["TEAM"],
      environment: "Campo aggiornato",
      equipment: "Attrezzo aggiornato",
      scoringSystem: "Punteggio aggiornato",
      keyRules: "Regola aggiornata",
      terminology: "Termine aggiornato",
      positions: "Ruolo aggiornato",
      movementPatterns: "Pattern aggiornato",
      gameSituations: "Situazione aggiornata",
      trainingMethods: "Metodo aggiornato",
      commonProblems: "Problema aggiornato",
      progressions: "Progressione aggiornata",
      safetyNotes: "Nota aggiornata",
      disciplines: ["Nuoto", "Ciclismo", "Corsa"],
    });

    const updated = await regenerateSportProfile(sportId);
    expect(updated.environment).toBe("Campo aggiornato");
    expect(updated.safetyNotes).toBe("Nota aggiornata");
    expect(updated.disciplines).toEqual(["Nuoto", "Ciclismo", "Corsa"]);

    const metrics = await prisma.sportMetric.findMany({ where: { sportId } });
    expect(metrics.length).toBeGreaterThan(0);
  });

  it("getCachedSportProfile never triggers generation, unlike getSportProfile", async () => {
    const sport = await createTestSport();
    sportId = sport.id;

    const { getCachedSportProfile } = await import("@/lib/sport");
    const { generateSportProfile } = await import("@/lib/ai-sport-profile");
    vi.mocked(generateSportProfile).mockClear();

    const profile = await getCachedSportProfile(sportId);
    expect(generateSportProfile).not.toHaveBeenCalled();
    expect(profile.environment).toBe("");

    const freshSport = await prisma.sport.findUnique({ where: { id: sportId } });
    expect(freshSport?.profileGeneratedAt).toBeNull();
  });

  it("ensureSportTaxonomy persists the category type", async () => {
    const sport = await createTestSport();
    sportId = sport.id;

    const { ensureSportTaxonomy } = await import("@/lib/sport");
    await ensureSportTaxonomy(sportId);

    const categories = await prisma.skillCategory.findMany({ where: { sportId } });
    expect(categories).toHaveLength(1);
    expect(categories[0].type).toBe("TECHNICAL");
  });
});

describe("formatSportProfileForPrompt", () => {
  it("includes every populated field and omits empty ones", async () => {
    const { formatSportProfileForPrompt } = await import("@/lib/sport");
    const text = formatSportProfileForPrompt("Beach Tennis", {
      formats: ["PAIR"],
      environment: "Sabbia",
      equipment: "Racchetta piena",
      scoringSystem: "Set e game",
      keyRules: "Niente palleggio a terra",
      terminology: "Smash, lob",
      positions: "",
      movementPatterns: "Spostamenti laterali rapidi su sabbia",
      gameSituations: "",
      trainingMethods: "",
      commonProblems: "",
      progressions: "",
      safetyNotes: "",
      disciplines: [],
    });
    expect(text).toContain("Sabbia");
    expect(text).toContain("Spostamenti laterali rapidi su sabbia");
    expect(text).not.toContain("Ruoli/posizioni");
    expect(text).not.toContain("Situazioni di gioco");
    expect(text).not.toContain("Discipline separate");
  });

  it("includes the disciplines line for a multi-discipline sport", async () => {
    const { formatSportProfileForPrompt } = await import("@/lib/sport");
    const text = formatSportProfileForPrompt("Triathlon", {
      formats: ["INDIVIDUAL"],
      environment: "Percorso misto acqua/strada",
      equipment: "Bici, muta, scarpe da corsa",
      scoringSystem: "Tempo totale più basso",
      keyRules: "Transizioni cronometrate",
      terminology: "Frazione, T1, T2",
      positions: "",
      movementPatterns: "",
      gameSituations: "",
      trainingMethods: "",
      commonProblems: "",
      progressions: "",
      safetyNotes: "",
      disciplines: ["Nuoto", "Ciclismo", "Corsa"],
    });
    expect(text).toContain("Discipline separate di questo sport: Nuoto, Ciclismo, Corsa");
  });

  it("falls back to just the sport name when nothing has been generated yet", async () => {
    const { formatSportProfileForPrompt } = await import("@/lib/sport");
    const text = formatSportProfileForPrompt("Sport Nuovo", {
      formats: [],
      environment: "",
      equipment: "",
      scoringSystem: "",
      keyRules: "",
      terminology: "",
      positions: "",
      movementPatterns: "",
      gameSituations: "",
      trainingMethods: "",
      commonProblems: "",
      progressions: "",
      safetyNotes: "",
      disciplines: [],
    });
    expect(text).toBe("Sport: Sport Nuovo");
  });
});
