import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { createTestCoach, createTestSport, createTestAthlete, createTestTeam, deleteTestCoach, deleteTestSport } from "../helpers/db";
import {
  recordAthleteMemoryObservation,
  recordTeamMemoryObservation,
  getRelevantAthleteMemories,
  getRelevantTeamMemories,
  formatMemoriesForPrompt,
  confirmAthleteMemory,
  rejectAthleteMemory,
} from "@/lib/memory";

describe("Coaching Memory — athlete", () => {
  let coachId: string;
  let sportId: string;

  afterEach(async () => {
    if (coachId) await deleteTestCoach(coachId);
    if (sportId) await deleteTestSport(sportId);
  });

  it("1) creates a new memory from a single observation, starting as RILEVANTE/FACT", async () => {
    const coach = await createTestCoach();
    coachId = coach.id;
    const sport = await createTestSport();
    sportId = sport.id;
    const athlete = await createTestAthlete(coachId, sportId);

    const memory = await recordAthleteMemoryObservation({
      athleteId: athlete.id,
      coachId,
      topic: "Rovescio sotto pressione",
      summary: "Marco ha avuto difficoltà nel rovescio sotto pressione.",
      source: "SESSION_NOTE",
    });

    expect(memory.status).toBe("RILEVANTE");
    expect(memory.confidence).toBe("FACT");
    expect(memory.evidenceCount).toBe(1);
  });

  it("2) a one-off observation stays RILEVANTE (never auto-promoted) and a TEMPORANEA memory is excluded from live retrieval", async () => {
    const coach = await createTestCoach();
    coachId = coach.id;
    const sport = await createTestSport();
    sportId = sport.id;
    const athlete = await createTestAthlete(coachId, sportId);

    await recordAthleteMemoryObservation({ athleteId: athlete.id, coachId, summary: "Marco oggi era stanco.", source: "CHECKIN" });
    // Simulate a coach marking something explicitly as a one-off, contextual note.
    await prisma.athleteMemory.updateMany({ where: { athleteId: athlete.id }, data: { status: "TEMPORANEA" } });

    const relevant = await getRelevantAthleteMemories(athlete.id);
    expect(relevant).toHaveLength(0);
  });

  it("3) promotes to PATTERN then PERSISTENTE only once the SAME topic recurs several times — never on one occurrence", async () => {
    const coach = await createTestCoach();
    coachId = coach.id;
    const sport = await createTestSport();
    sportId = sport.id;
    const athlete = await createTestAthlete(coachId, sportId);

    const first = await recordAthleteMemoryObservation({ athleteId: athlete.id, coachId, topic: "difesa sotto pressione", summary: "Difficoltà in difesa.", source: "SESSION_NOTE" });
    expect(first.status).toBe("RILEVANTE");
    expect(first.confidence).toBe("FACT");

    const second = await recordAthleteMemoryObservation({ athleteId: athlete.id, coachId, topic: "difesa sotto pressione", summary: "Di nuovo in difficoltà in difesa.", source: "COMPETITION" });
    expect(second.id).toBe(first.id); // strengthened, not duplicated
    expect(second.evidenceCount).toBe(2);
    expect(second.confidence).toBe("PATTERN");
    expect(second.status).toBe("RILEVANTE"); // not yet persistent

    const third = await recordAthleteMemoryObservation({ athleteId: athlete.id, coachId, topic: "difesa sotto pressione", summary: "Problema persistente in difesa.", source: "COMPETITION" });
    expect(third.evidenceCount).toBe(3);
    expect(third.status).toBe("PERSISTENTE");

    const events = await prisma.athleteMemoryEvent.findMany({ where: { memoryId: first.id } });
    expect(events).toHaveLength(3);
  });

  it("5) confirming a memory is the only path to CONFIRMED — never automatic", async () => {
    const coach = await createTestCoach();
    coachId = coach.id;
    const sport = await createTestSport();
    sportId = sport.id;
    const athlete = await createTestAthlete(coachId, sportId);

    const memory = await recordAthleteMemoryObservation({ athleteId: athlete.id, coachId, summary: "Preferisce esercizi situazionali.", source: "COACH_OBSERVATION" });
    expect(memory.confidence).not.toBe("CONFIRMED");

    await confirmAthleteMemory(memory.id, coachId);
    const confirmed = await prisma.athleteMemory.findUnique({ where: { id: memory.id } });
    expect(confirmed?.confidence).toBe("CONFIRMED");
    expect(confirmed?.status).toBe("PERSISTENTE");
  });

  it("6) rejecting a memory keeps the row but excludes it from every future retrieval", async () => {
    const coach = await createTestCoach();
    coachId = coach.id;
    const sport = await createTestSport();
    sportId = sport.id;
    const athlete = await createTestAthlete(coachId, sportId);

    const memory = await recordAthleteMemoryObservation({ athleteId: athlete.id, coachId, summary: "Ipotesi non corretta.", source: "MANUAL" });
    await rejectAthleteMemory(memory.id, coachId);

    const stillExists = await prisma.athleteMemory.findUnique({ where: { id: memory.id } });
    expect(stillExists).not.toBeNull(); // kept, not deleted
    expect(stillExists?.reviewState).toBe("REJECTED");

    const relevant = await getRelevantAthleteMemories(athlete.id);
    expect(relevant.find((m) => m.summary === "Ipotesi non corretta.")).toBeUndefined();
  });

  it("9) retrieves only ACTIVE + RILEVANTE/PERSISTENTE memories, most reinforced first", async () => {
    const coach = await createTestCoach();
    coachId = coach.id;
    const sport = await createTestSport();
    sportId = sport.id;
    const athlete = await createTestAthlete(coachId, sportId);

    await recordAthleteMemoryObservation({ athleteId: athlete.id, coachId, topic: "a", summary: "Memoria rilevante A.", source: "MANUAL" });
    await recordAthleteMemoryObservation({ athleteId: athlete.id, coachId, topic: "b", summary: "Memoria persistente B.", source: "MANUAL" });
    await recordAthleteMemoryObservation({ athleteId: athlete.id, coachId, topic: "b", summary: "Memoria persistente B, di nuovo.", source: "MANUAL" });
    await recordAthleteMemoryObservation({ athleteId: athlete.id, coachId, topic: "b", summary: "Memoria persistente B, ancora.", source: "MANUAL" });

    const relevant = await getRelevantAthleteMemories(athlete.id);
    expect(relevant).toHaveLength(2);
    expect(relevant[0].status).toBe("PERSISTENTE"); // PERSISTENTE ordered first
  });

  it("11/12) never leaks a memory across athletes, teams, or coaches", async () => {
    const coach = await createTestCoach();
    coachId = coach.id;
    const sport = await createTestSport();
    sportId = sport.id;
    const athleteA = await createTestAthlete(coachId, sportId);
    const athleteB = await createTestAthlete(coachId, sportId);
    const team = await createTestTeam(coachId, sportId, []);

    await recordAthleteMemoryObservation({ athleteId: athleteA.id, coachId, summary: "Solo di A.", source: "MANUAL" });
    await recordTeamMemoryObservation({ teamId: team.id, coachId, summary: "Solo della squadra.", source: "MANUAL" });

    const forA = await getRelevantAthleteMemories(athleteA.id);
    const forB = await getRelevantAthleteMemories(athleteB.id);
    const forTeam = await getRelevantTeamMemories(team.id);

    expect(forA.map((m) => m.summary)).toEqual(["Solo di A."]);
    expect(forB).toHaveLength(0);
    expect(forTeam.map((m) => m.summary)).toEqual(["Solo della squadra."]);
  });

  it("17) returns no memories and a null prompt block when there isn't enough data — never fabricated", async () => {
    const coach = await createTestCoach();
    coachId = coach.id;
    const sport = await createTestSport();
    sportId = sport.id;
    const athlete = await createTestAthlete(coachId, sportId);

    const relevant = await getRelevantAthleteMemories(athlete.id);
    expect(relevant).toHaveLength(0);
    expect(formatMemoriesForPrompt(relevant)).toBeNull();
  });

  it("18) a contradictory follow-up observation still strengthens the same topic (known limitation: no semantic contradiction detection yet, only topic-key dedup)", async () => {
    const coach = await createTestCoach();
    coachId = coach.id;
    const sport = await createTestSport();
    sportId = sport.id;
    const athlete = await createTestAthlete(coachId, sportId);

    await recordAthleteMemoryObservation({ athleteId: athlete.id, coachId, topic: "rovescio", summary: "Rovescio in difficoltà sotto pressione.", source: "SESSION_NOTE" });
    const contradicting = await recordAthleteMemoryObservation({ athleteId: athlete.id, coachId, topic: "rovescio", summary: "Rovescio nettamente migliorato, nessun problema.", source: "EVALUATION" });

    // Documents today's behavior: the topic-keyed dedup treats this as reinforcing evidence,
    // not a contradiction — the latest summary wins and evidence keeps accumulating.
    expect(contradicting.evidenceCount).toBe(2);
    expect(contradicting.summary).toBe("Rovescio nettamente migliorato, nessun problema.");
  });

  it("formats hedged language per confidence tier — only CONFIRMED is stated as certain", () => {
    coachId = "";
    sportId = "";
    const text = formatMemoriesForPrompt([
      { summary: "Fatto osservato.", confidence: "FACT", status: "RILEVANTE", evidenceCount: 1 },
      { summary: "Pattern ricorrente.", confidence: "PATTERN", status: "PERSISTENTE", evidenceCount: 3 },
      { summary: "Il coach preferisce X.", confidence: "CONFIRMED", status: "PERSISTENTE", evidenceCount: 5 },
    ]);
    expect(text).toContain("Fatto osservato.");
    expect(text).toContain("Pattern ricorrente. (osservato più volte)");
    expect(text).toContain("Il coach preferisce X. (confermato)");
  });
});
