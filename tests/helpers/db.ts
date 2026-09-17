import { prisma } from "@/lib/prisma";

let counter = 0;

/** Unique-enough id per test run so parallel test files (were they ever enabled) never collide. */
function uniqueSuffix(): string {
  counter += 1;
  return `${Date.now()}-${process.pid}-${counter}`;
}

export async function createTestCoach(overrides?: Partial<{ name: string; email: string }>) {
  const suffix = uniqueSuffix();
  return prisma.coach.create({
    data: {
      name: overrides?.name ?? `Test Coach ${suffix}`,
      email: overrides?.email ?? `test-coach-${suffix}@example.test`,
      passwordHash: "not-a-real-hash",
    },
  });
}

/** Sports are shared reference data (like the real seed) — reuse one per test run instead of creating one per athlete. */
export async function createTestSport() {
  const suffix = uniqueSuffix();
  return prisma.sport.create({
    data: { slug: `test-sport-${suffix}`, name: `Test Sport ${suffix}` },
  });
}

export async function createTestAthlete(coachId: string, sportId: string, overrides?: Partial<{ name: string; isSelf: boolean }>) {
  const suffix = uniqueSuffix();
  return prisma.athlete.create({
    data: {
      coachId,
      sportId,
      name: overrides?.name ?? `Test Athlete ${suffix}`,
      isSelf: overrides?.isSelf ?? false,
    },
  });
}

export async function createTestTeam(coachId: string, sportId: string, athleteIds: string[] = []) {
  const suffix = uniqueSuffix();
  return prisma.team.create({
    data: {
      coachId,
      sportId,
      name: `Test Team ${suffix}`,
      members: { create: athleteIds.map((athleteId) => ({ athleteId })) },
    },
  });
}

export async function createTestOffer(coachId: string, overrides?: Partial<{ priceCents: number; sessionCount: number }>) {
  const suffix = uniqueSuffix();
  return prisma.offer.create({
    data: {
      coachId,
      name: `Test Offer ${suffix}`,
      type: "SINGLE_SESSION",
      eligibility: "INDIVIDUAL",
      sessionCount: overrides?.sessionCount ?? 1,
      priceCents: overrides?.priceCents ?? 1000,
      currency: "EUR",
      active: true,
    },
  });
}

/** Deletes a coach and everything under it — the same cascade a real account deletion would need. */
export async function deleteTestCoach(coachId: string) {
  await prisma.athleteInjuryEvent.deleteMany({ where: { injury: { coachId } } });
  await prisma.$transaction([
    prisma.athleteInjury.deleteMany({ where: { coachId } }),
    prisma.coachMethodologyPrinciple.deleteMany({ where: { coachId } }),
    prisma.coachMethodologyVersion.deleteMany({ where: { coachId } }),
    prisma.athleteCheckin.deleteMany({ where: { coachId } }),
    prisma.athleteMetricValue.deleteMany({ where: { coachId } }),
    prisma.payment.deleteMany({ where: { purchase: { coachId } } }),
    prisma.purchase.deleteMany({ where: { coachId } }),
    prisma.calendarEvent.deleteMany({ where: { coachId } }),
    prisma.coachingRecommendation.deleteMany({ where: { coachId } }),
    prisma.sessionBlock.deleteMany({ where: { trainingSession: { coachId } } }),
    prisma.trainingSession.deleteMany({ where: { coachId } }),
    prisma.noteTag.deleteMany({ where: { sessionNote: { coachId } } }),
    prisma.sessionNote.deleteMany({ where: { coachId } }),
    prisma.evaluationScore.deleteMany({ where: { evaluation: { coachId } } }),
    prisma.evaluation.deleteMany({ where: { coachId } }),
    prisma.competition.deleteMany({ where: { coachId } }),
    prisma.objective.deleteMany({ where: { coachId } }),
    prisma.evaluationCriterion.deleteMany({ where: { coachId } }),
    prisma.teamMember.deleteMany({ where: { team: { coachId } } }),
    prisma.team.deleteMany({ where: { coachId } }),
    prisma.exercise.deleteMany({ where: { coachId } }),
    prisma.athlete.deleteMany({ where: { coachId } }),
    prisma.offer.deleteMany({ where: { coachId } }),
    prisma.passwordResetToken.deleteMany({ where: { coachId } }),
    prisma.coachFeedbackSignal.deleteMany({ where: { coachId } }),
  ]);
  await prisma.coach.delete({ where: { id: coachId } });
}

/** Sport is shared reference data — delete it explicitly once nothing references it anymore. */
export async function deleteTestSport(sportId: string) {
  await prisma.sportMetric.deleteMany({ where: { sportId } });
  await prisma.skill.deleteMany({ where: { category: { sportId } } });
  await prisma.skillCategory.deleteMany({ where: { sportId } });
  await prisma.sport.delete({ where: { id: sportId } });
}
