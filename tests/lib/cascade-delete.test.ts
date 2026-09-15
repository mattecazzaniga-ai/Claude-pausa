import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { deleteAthleteCascade, deleteTeamCascade } from "@/lib/cascade-delete";
import { createTestCoach, createTestSport, createTestAthlete, createTestOffer, deleteTestCoach, deleteTestSport } from "../helpers/db";

describe("deleteAthleteCascade", () => {
  let coachId: string;
  let sportId: string;

  afterEach(async () => {
    if (coachId) await deleteTestCoach(coachId);
    if (sportId) await deleteTestSport(sportId);
  });

  it("removes every dependent row without violating a foreign key, and leaves other athletes untouched", async () => {
    const coach = await createTestCoach();
    coachId = coach.id;
    const sport = await createTestSport();
    sportId = sport.id;

    const athlete = await createTestAthlete(coachId, sportId);
    const untouchedAthlete = await createTestAthlete(coachId, sportId, { name: "Should survive" });

    const trainingSession = await prisma.trainingSession.create({
      data: { coachId, athleteId: athlete.id, durationMinutes: 60 },
    });
    await prisma.sessionBlock.create({
      data: { trainingSessionId: trainingSession.id, order: 1, type: "WARMUP", durationMinutes: 10 },
    });

    await prisma.sessionNote.create({
      data: { athleteId: athlete.id, coachId, rawText: "Nota di prova per il test di cascata." },
    });

    const criterion = await prisma.evaluationCriterion.create({
      data: { sportId, coachId, category: "Tecnica", name: "Controllo palla", scoreType: "SCALE_1_10" },
    });
    const evaluation = await prisma.evaluation.create({
      data: { coachId, athleteId: athlete.id, kind: "INITIAL" },
    });
    await prisma.evaluationScore.create({
      data: { evaluationId: evaluation.id, criterionId: criterion.id, value: "7" },
    });

    await prisma.competition.create({
      data: { coachId, athleteId: athlete.id, sportId, name: "Torneo di prova", type: "TOURNAMENT", scheduledAt: new Date() },
    });

    await prisma.objective.create({
      data: { coachId, athleteId: athlete.id, title: "Obiettivo di prova", termLength: "SHORT", kind: "QUALITATIVE" },
    });

    await prisma.calendarEvent.create({
      data: {
        coachId,
        athleteId: athlete.id,
        type: "TRAINING",
        title: "Allenamento di prova",
        startAt: new Date(),
        endAt: new Date(Date.now() + 3600_000),
      },
    });

    await prisma.coachingRecommendation.create({
      data: {
        coachId,
        athleteId: athlete.id,
        actionType: "TRAIN_SKILL",
        priorityLabel: "Alta",
        facts: {},
        pattern: "pattern di prova",
        recommendation: "raccomandazione di prova",
        confidence: "MEDIUM",
      },
    });

    const offer = await createTestOffer(coachId);
    const purchase = await prisma.purchase.create({
      data: { coachId, athleteId: athlete.id, offerId: offer.id, priceCents: offer.priceCents, currency: "EUR" },
    });
    await prisma.payment.create({
      data: { purchaseId: purchase.id, method: "OFFLINE_CASH", amountCents: offer.priceCents, currency: "EUR" },
    });

    await prisma.$transaction((tx) => deleteAthleteCascade(tx, athlete.id));

    // The athlete and every one of its dependents are gone.
    await expect(prisma.athlete.findUnique({ where: { id: athlete.id } })).resolves.toBeNull();
    await expect(prisma.trainingSession.findMany({ where: { athleteId: athlete.id } })).resolves.toHaveLength(0);
    await expect(prisma.sessionBlock.findMany({ where: { trainingSessionId: trainingSession.id } })).resolves.toHaveLength(0);
    await expect(prisma.sessionNote.findMany({ where: { athleteId: athlete.id } })).resolves.toHaveLength(0);
    await expect(prisma.evaluation.findMany({ where: { athleteId: athlete.id } })).resolves.toHaveLength(0);
    await expect(prisma.evaluationScore.findMany({ where: { evaluationId: evaluation.id } })).resolves.toHaveLength(0);
    await expect(prisma.competition.findMany({ where: { athleteId: athlete.id } })).resolves.toHaveLength(0);
    await expect(prisma.objective.findMany({ where: { athleteId: athlete.id } })).resolves.toHaveLength(0);
    await expect(prisma.calendarEvent.findMany({ where: { athleteId: athlete.id } })).resolves.toHaveLength(0);
    await expect(prisma.coachingRecommendation.findMany({ where: { athleteId: athlete.id } })).resolves.toHaveLength(0);
    await expect(prisma.purchase.findMany({ where: { athleteId: athlete.id } })).resolves.toHaveLength(0);
    await expect(prisma.payment.findMany({ where: { purchaseId: purchase.id } })).resolves.toHaveLength(0);

    // The criterion (shared reference data, not athlete-owned) and the sibling athlete survive.
    await expect(prisma.evaluationCriterion.findUnique({ where: { id: criterion.id } })).resolves.not.toBeNull();
    await expect(prisma.athlete.findUnique({ where: { id: untouchedAthlete.id } })).resolves.not.toBeNull();
  });
});

describe("deleteTeamCascade", () => {
  let coachId: string;
  let sportId: string;

  afterEach(async () => {
    if (coachId) await deleteTestCoach(coachId);
    if (sportId) await deleteTestSport(sportId);
  });

  it("removes the team and its dependents, and leaves its former member athlete intact", async () => {
    const coach = await createTestCoach();
    coachId = coach.id;
    const sport = await createTestSport();
    sportId = sport.id;

    const athlete = await createTestAthlete(coachId, sportId);
    const team = await prisma.team.create({ data: { coachId, sportId, name: "Squadra di prova" } });
    await prisma.teamMember.create({ data: { teamId: team.id, athleteId: athlete.id } });

    const trainingSession = await prisma.trainingSession.create({
      data: { coachId, teamId: team.id, durationMinutes: 60 },
    });
    await prisma.sessionBlock.create({
      data: { trainingSessionId: trainingSession.id, order: 1, type: "WARMUP", durationMinutes: 10 },
    });

    await prisma.objective.create({
      data: { coachId, teamId: team.id, title: "Obiettivo squadra", termLength: "SHORT", kind: "QUALITATIVE" },
    });

    await prisma.$transaction((tx) => deleteTeamCascade(tx, team.id));

    await expect(prisma.team.findUnique({ where: { id: team.id } })).resolves.toBeNull();
    await expect(prisma.teamMember.findMany({ where: { teamId: team.id } })).resolves.toHaveLength(0);
    await expect(prisma.trainingSession.findMany({ where: { teamId: team.id } })).resolves.toHaveLength(0);
    await expect(prisma.objective.findMany({ where: { teamId: team.id } })).resolves.toHaveLength(0);

    // Deleting the team's roster link must never delete the athlete itself.
    await expect(prisma.athlete.findUnique({ where: { id: athlete.id } })).resolves.not.toBeNull();
  });
});
