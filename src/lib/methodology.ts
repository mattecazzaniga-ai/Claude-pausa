import { prisma } from "@/lib/prisma";
import type { Prisma, MethodologyPrincipleCategory } from "@prisma/client";

/**
 * "La mia metodologia" (master prompt §8-12) — principles the coach wrote or
 * uploaded and explicitly confirmed. Deliberately distinct from Coach Brain
 * (lib/intelligence/coach-brain.ts), which infers behavior from feedback
 * signals: this is exactly what the coach said, never a guess. Every
 * mutation goes through saveMethodologyVersion so the version history in
 * CoachMethodologyVersion always reflects a real, complete change.
 */

export type MethodologyPrincipleInput = { text: string; category: MethodologyPrincipleCategory };

export const CATEGORY_LABEL_IT: Record<MethodologyPrincipleCategory, string> = {
  FILOSOFIA: "Filosofia",
  VOLUME: "Volume",
  INTENSITA: "Intensità",
  RECUPERO: "Recupero",
  PROGRESSIONE: "Progressione",
  REGRESSIONE: "Regressione",
  PERIODIZZAZIONE: "Periodizzazione",
  SCELTA_ESERCIZI: "Scelta esercizi",
  ESERCIZI_PREFERITI: "Esercizi preferiti",
  ESERCIZI_DA_EVITARE: "Esercizi da evitare",
  PRE_COMPETIZIONE: "Pre-competizione",
  POST_COMPETIZIONE: "Post-competizione",
  LIVELLI_ETA: "Regole per livelli/età",
  REGOLE_SPORT_SPECIFICHE: "Regole sport-specifiche",
  ALTRO: "Altro",
};

export async function getMethodologyPrinciples(coachId: string) {
  return prisma.coachMethodologyPrinciple.findMany({ where: { coachId }, orderBy: { order: "asc" } });
}

export async function getCurrentMethodologyVersion(coachId: string): Promise<number | null> {
  const latest = await prisma.coachMethodologyVersion.findFirst({
    where: { coachId },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  return latest?.version ?? null;
}

export async function getMethodologyHistory(coachId: string) {
  return prisma.coachMethodologyVersion.findMany({
    where: { coachId },
    orderBy: { version: "desc" },
    select: { id: true, version: true, changeSummary: true, createdAt: true, principles: true },
  });
}

function describeDiff(previous: MethodologyPrincipleInput[], next: MethodologyPrincipleInput[]): string {
  const prevTexts = new Set(previous.map((p) => p.text));
  const nextTexts = new Set(next.map((p) => p.text));
  const added = next.filter((p) => !prevTexts.has(p.text)).length;
  const removed = previous.filter((p) => !nextTexts.has(p.text)).length;
  if (added === 0 && removed === 0) return "Nessuna modifica ai principi.";
  const parts: string[] = [];
  if (added > 0) parts.push(`+${added} principi`);
  if (removed > 0) parts.push(`-${removed} principi`);
  return parts.join(", ");
}

/**
 * Replaces the coach's live principle set and snapshots a new version —
 * the one place every mutation path (manual add/edit/delete, or a
 * confirmed AI import) goes through, so version history always reflects
 * every real change rather than only some of them.
 */
export async function saveMethodologyVersion(
  coachId: string,
  principles: MethodologyPrincipleInput[],
  changeSummary?: string
): Promise<number> {
  const [previous, latest] = await Promise.all([
    getMethodologyPrinciples(coachId),
    prisma.coachMethodologyVersion.findFirst({ where: { coachId }, orderBy: { version: "desc" }, select: { version: true } }),
  ]);
  const nextVersion = (latest?.version ?? 0) + 1;
  const summary = changeSummary ?? describeDiff(previous, principles);

  await prisma.$transaction([
    prisma.coachMethodologyPrinciple.deleteMany({ where: { coachId } }),
    prisma.coachMethodologyPrinciple.createMany({
      data: principles.map((p, i) => ({ coachId, text: p.text, category: p.category, order: i })),
    }),
    prisma.coachMethodologyVersion.create({
      data: { coachId, version: nextVersion, principles: principles as unknown as Prisma.InputJsonValue, changeSummary: summary },
    }),
  ]);

  return nextVersion;
}

/** Instruction block spliced into a coaching AI prompt — clearly labeled as coach-authored, not observed. */
export function formatMethodologyForPrompt(principles: { text: string; category: MethodologyPrincipleCategory }[]): string | null {
  if (principles.length === 0) return null;

  const lines = principles.map((p) => `- [${CATEGORY_LABEL_IT[p.category]}] ${p.text}`);
  return (
    "METODOLOGIA DICHIARATA DA QUESTO ALLENATORE (principi scritti o caricati esplicitamente da lui, non un'osservazione automatica — " +
    "applicali attivamente quando pertinenti, ma mai a scapito di un rischio evidente o di una limitazione fisica registrata):\n" +
    lines.join("\n")
  );
}

export async function getMethodologyPromptText(coachId: string): Promise<string | null> {
  const principles = await getMethodologyPrinciples(coachId);
  return formatMethodologyForPrompt(principles);
}
