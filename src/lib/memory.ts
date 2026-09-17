import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/sport";
import type { MemorySource, MemoryStatus, MemoryConfidence } from "@prisma/client";

/**
 * Coaching Memory (master prompt COACH BRAIN + COACHING MEMORY, §6-10):
 * atomic, dated observations about an athlete or team — distinct from Coach
 * Brain (Coach.learnedPreferences / CoachMethodology*), which is about how
 * the COACH works, never the subject being coached (§19).
 *
 * Selectivity (§8): a single observation is never automatically permanent.
 * recordAthleteMemoryObservation groups repeated observations of the same
 * underlying thing via `topic` (a slugified key the caller derives from
 * whatever it's observing, e.g. a skill name) — the first occurrence starts
 * RILEVANTE/FACT; only when the SAME topic recurs does it strengthen into
 * PATTERN, and only after several recurrences into PERSISTENTE. It never
 * auto-promotes to CONFIRMED — that tier is reserved for an explicit coach
 * confirmation action (confirmAthleteMemory), never inferred (§9-10).
 */

const PATTERN_THRESHOLD = 2; // 2nd matching observation -> PATTERN
const PERSISTENT_THRESHOLD = 3; // 3rd matching observation -> PERSISTENTE

export type MemoryObservationInput = {
  athleteId: string;
  coachId: string;
  topic?: string;
  summary: string;
  source: MemorySource;
  occurredAt?: Date;
};

/**
 * Records one dated observation about an athlete. If `topic` matches an
 * existing ACTIVE memory for this athlete, strengthens it (new evidence
 * event + evidenceCount++) instead of creating a duplicate row, and
 * promotes status/confidence once the evidence count crosses a threshold.
 * Without a topic, always creates a new one-off memory (nothing to group
 * repeated observations against).
 */
export async function recordAthleteMemoryObservation(input: MemoryObservationInput) {
  const topic = input.topic ? slugify(input.topic) : null;
  const occurredAt = input.occurredAt ?? new Date();

  if (topic) {
    const existing = await prisma.athleteMemory.findFirst({
      where: { athleteId: input.athleteId, topic, reviewState: "ACTIVE" },
    });
    if (existing) {
      const evidenceCount = existing.evidenceCount + 1;
      const confidence: MemoryConfidence = evidenceCount >= PATTERN_THRESHOLD ? "PATTERN" : existing.confidence;
      const status: MemoryStatus = evidenceCount >= PERSISTENT_THRESHOLD ? "PERSISTENTE" : existing.status;

      await prisma.athleteMemoryEvent.create({ data: { memoryId: existing.id, note: input.summary, occurredAt } });
      return prisma.athleteMemory.update({
        where: { id: existing.id },
        data: { evidenceCount, confidence, status, summary: input.summary, lastObservedAt: occurredAt },
      });
    }
  }

  return prisma.athleteMemory.create({
    data: {
      athleteId: input.athleteId,
      coachId: input.coachId,
      topic,
      summary: input.summary,
      source: input.source,
      firstObservedAt: occurredAt,
      lastObservedAt: occurredAt,
      events: { create: { note: input.summary, occurredAt } },
    },
  });
}

export type TeamMemoryObservationInput = {
  teamId: string;
  coachId: string;
  topic?: string;
  summary: string;
  source: MemorySource;
  occurredAt?: Date;
};

/** Team-scoped counterpart — same grouping/promotion rule as the athlete version. */
export async function recordTeamMemoryObservation(input: TeamMemoryObservationInput) {
  const topic = input.topic ? slugify(input.topic) : null;
  const occurredAt = input.occurredAt ?? new Date();

  if (topic) {
    const existing = await prisma.teamMemory.findFirst({
      where: { teamId: input.teamId, topic, reviewState: "ACTIVE" },
    });
    if (existing) {
      const evidenceCount = existing.evidenceCount + 1;
      const confidence: MemoryConfidence = evidenceCount >= PATTERN_THRESHOLD ? "PATTERN" : existing.confidence;
      const status: MemoryStatus = evidenceCount >= PERSISTENT_THRESHOLD ? "PERSISTENTE" : existing.status;

      await prisma.teamMemoryEvent.create({ data: { memoryId: existing.id, note: input.summary, occurredAt } });
      return prisma.teamMemory.update({
        where: { id: existing.id },
        data: { evidenceCount, confidence, status, summary: input.summary, lastObservedAt: occurredAt },
      });
    }
  }

  return prisma.teamMemory.create({
    data: {
      teamId: input.teamId,
      coachId: input.coachId,
      topic,
      summary: input.summary,
      source: input.source,
      firstObservedAt: occurredAt,
      lastObservedAt: occurredAt,
      events: { create: { note: input.summary, occurredAt } },
    },
  });
}

export type MemorySummary = { summary: string; confidence: MemoryConfidence; status: MemoryStatus; evidenceCount: number };

const RETRIEVAL_LIMIT = 8;

/**
 * What a live AI decision actually retrieves (§26: targeted retrieval, not
 * the whole memory store). Only RILEVANTE/PERSISTENTE + ACTIVE memories —
 * TEMPORANEA is scoped to its own moment and STORICA is for the timeline
 * view, not live decisions; REJECTED is excluded outright (§24).
 * PERSISTENTE first (the most load-bearing knowledge), then most recently
 * reinforced.
 */
export async function getRelevantAthleteMemories(athleteId: string, limit = RETRIEVAL_LIMIT): Promise<MemorySummary[]> {
  const memories = await prisma.athleteMemory.findMany({
    where: { athleteId, reviewState: "ACTIVE", status: { in: ["RILEVANTE", "PERSISTENTE"] } },
    // Enum declaration order is TEMPORANEA/RILEVANTE/PERSISTENTE/STORICA, so
    // "desc" puts PERSISTENTE (the more load-bearing tier) ahead of RILEVANTE.
    orderBy: [{ status: "desc" }, { lastObservedAt: "desc" }],
    take: limit,
  });
  return memories.map((m) => ({ summary: m.summary, confidence: m.confidence, status: m.status, evidenceCount: m.evidenceCount }));
}

export async function getRelevantTeamMemories(teamId: string, limit = RETRIEVAL_LIMIT): Promise<MemorySummary[]> {
  const memories = await prisma.teamMemory.findMany({
    where: { teamId, reviewState: "ACTIVE", status: { in: ["RILEVANTE", "PERSISTENTE"] } },
    orderBy: [{ status: "desc" }, { lastObservedAt: "desc" }],
    take: limit,
  });
  return memories.map((m) => ({ summary: m.summary, confidence: m.confidence, status: m.status, evidenceCount: m.evidenceCount }));
}

const CONFIDENCE_HEDGE: Record<MemoryConfidence, (summary: string) => string> = {
  FACT: (s) => s,
  PATTERN: (s) => `${s} (osservato più volte)`,
  PREFERENCE: (s) => `Possibile pattern: ${s}`,
  CONFIRMED: (s) => `${s} (confermato)`,
};

/**
 * Renders memories as prompt text — every tier below CONFIRMED is hedged in
 * the wording itself (§9-10: never present an inference as settled fact),
 * mirroring the same discipline already used for bottleneck diagnosis and
 * performance-level assessment.
 */
export function formatMemoriesForPrompt(memories: MemorySummary[]): string | null {
  if (memories.length === 0) return null;
  const lines = memories.map((m) => `- ${CONFIDENCE_HEDGE[m.confidence](m.summary)}`);
  return "Cose rilevanti che MENTATHLOS ha osservato in passato su questo soggetto:\n" + lines.join("\n");
}

/** §24: the coach can reject a memory outright — kept, not deleted, but excluded from every future retrieval. */
export async function rejectAthleteMemory(memoryId: string, coachId: string): Promise<void> {
  await prisma.athleteMemory.updateMany({ where: { id: memoryId, coachId }, data: { reviewState: "REJECTED" } });
}

export async function rejectTeamMemory(memoryId: string, coachId: string): Promise<void> {
  await prisma.teamMemory.updateMany({ where: { id: memoryId, coachId }, data: { reviewState: "REJECTED" } });
}

/** §10: the only path to CONFIRMED — an explicit coach action, never an automatic promotion. */
export async function confirmAthleteMemory(memoryId: string, coachId: string): Promise<void> {
  await prisma.athleteMemory.updateMany({ where: { id: memoryId, coachId }, data: { confidence: "CONFIRMED", status: "PERSISTENTE" } });
}

export async function confirmTeamMemory(memoryId: string, coachId: string): Promise<void> {
  await prisma.teamMemory.updateMany({ where: { id: memoryId, coachId }, data: { confidence: "CONFIRMED", status: "PERSISTENTE" } });
}
