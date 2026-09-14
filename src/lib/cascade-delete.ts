import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

/**
 * Deleting an Athlete/Team touches every entity that references it, several
 * of which are RESTRICT foreign keys (SessionNote/NoteTag, SessionBlock,
 * EvaluationScore, TeamMember, Purchase/Payment) — a naive `.delete()` would
 * fail on any athlete/team that actually has data. This walks the real
 * dependency graph in the only safe order (leaves first), inside the
 * caller's transaction, and is used from both the athlete and team DELETE
 * routes.
 */
export async function deleteAthleteCascade(tx: Tx, athleteId: string): Promise<void> {
  await tx.calendarEvent.deleteMany({ where: { athleteId } });
  await tx.coachingRecommendation.deleteMany({ where: { athleteId } });

  const sessions = await tx.trainingSession.findMany({ where: { athleteId }, select: { id: true } });
  const sessionIds = sessions.map((s) => s.id);
  if (sessionIds.length > 0) await tx.sessionBlock.deleteMany({ where: { trainingSessionId: { in: sessionIds } } });
  await tx.trainingSession.deleteMany({ where: { athleteId } });

  const notes = await tx.sessionNote.findMany({ where: { athleteId }, select: { id: true } });
  const noteIds = notes.map((n) => n.id);
  if (noteIds.length > 0) await tx.noteTag.deleteMany({ where: { sessionNoteId: { in: noteIds } } });
  await tx.sessionNote.deleteMany({ where: { athleteId } });

  const evaluations = await tx.evaluation.findMany({ where: { athleteId }, select: { id: true } });
  const evaluationIds = evaluations.map((e) => e.id);
  if (evaluationIds.length > 0) await tx.evaluationScore.deleteMany({ where: { evaluationId: { in: evaluationIds } } });
  await tx.evaluation.deleteMany({ where: { athleteId } });

  await tx.competition.deleteMany({ where: { athleteId } });
  await tx.objective.deleteMany({ where: { athleteId } });

  const purchases = await tx.purchase.findMany({ where: { athleteId }, select: { id: true } });
  const purchaseIds = purchases.map((p) => p.id);
  if (purchaseIds.length > 0) await tx.payment.deleteMany({ where: { purchaseId: { in: purchaseIds } } });
  await tx.purchase.deleteMany({ where: { athleteId } });

  await tx.teamMember.deleteMany({ where: { athleteId } });

  await tx.athlete.delete({ where: { id: athleteId } });
}

/** Same idea as {@link deleteAthleteCascade}, for a Team — Teams never own Purchases directly. */
export async function deleteTeamCascade(tx: Tx, teamId: string): Promise<void> {
  await tx.calendarEvent.deleteMany({ where: { teamId } });
  await tx.coachingRecommendation.deleteMany({ where: { teamId } });

  const sessions = await tx.trainingSession.findMany({ where: { teamId }, select: { id: true } });
  const sessionIds = sessions.map((s) => s.id);
  if (sessionIds.length > 0) await tx.sessionBlock.deleteMany({ where: { trainingSessionId: { in: sessionIds } } });
  await tx.trainingSession.deleteMany({ where: { teamId } });

  const evaluations = await tx.evaluation.findMany({ where: { teamId }, select: { id: true } });
  const evaluationIds = evaluations.map((e) => e.id);
  if (evaluationIds.length > 0) await tx.evaluationScore.deleteMany({ where: { evaluationId: { in: evaluationIds } } });
  await tx.evaluation.deleteMany({ where: { teamId } });

  await tx.competition.deleteMany({ where: { teamId } });
  await tx.objective.deleteMany({ where: { teamId } });

  await tx.teamMember.deleteMany({ where: { teamId } });

  await tx.team.delete({ where: { id: teamId } });
}
