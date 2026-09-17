import { prisma } from "@/lib/prisma";
import type { InjuryType, InjurySide, InjuryStatus } from "@prisma/client";

/**
 * Injuries & Discomfort (master prompt §13-20). Deliberately never a
 * diagnosis — only what the coach/athlete registered. Framed to the AI as
 * "reported data", not a medical finding, per §20's Fact/Inference/
 * Recommendation split. RESOLVED/ARCHIVED are never "active" (§20's own
 * test requirement): only these three statuses count for the Decision
 * Engine and for session generation.
 */
export const ACTIVE_INJURY_STATUSES: InjuryStatus[] = ["ACTIVE", "MONITORING", "RETURNING"];

export type InjurySummary = {
  type: InjuryType;
  bodyRegion: string;
  side: InjurySide;
  areaDetail: string | null;
  status: InjuryStatus;
  startDate: Date;
  reportedLimitations: string | null;
};

export async function getActiveInjuries(athleteId: string): Promise<InjurySummary[]> {
  return prisma.athleteInjury.findMany({
    where: { athleteId, status: { in: ACTIVE_INJURY_STATUSES } },
    orderBy: { startDate: "desc" },
    select: { type: true, bodyRegion: true, side: true, areaDetail: true, status: true, startDate: true, reportedLimitations: true },
  });
}

const TYPE_LABEL_IT: Record<InjuryType, string> = {
  INFORTUNIO: "Infortunio",
  FASTIDIO: "Fastidio",
  DOLORE_RIFERITO: "Dolore riferito",
  LIMITAZIONE: "Limitazione",
  PROBLEMA_RICORRENTE: "Problema ricorrente",
  ALTRO: "Altro",
};

const STATUS_LABEL_IT: Record<InjuryStatus, string> = {
  ACTIVE: "attivo",
  MONITORING: "monitorato",
  RETURNING: "rientro progressivo",
  RESOLVED: "risolto",
  ARCHIVED: "archiviato",
};

const SIDE_LABEL_IT: Record<InjurySide, string> = {
  LEFT: "sinistro",
  RIGHT: "destro",
  BILATERAL: "bilaterale",
  NOT_APPLICABLE: "",
};

/** Instruction block spliced into a session-generation prompt — never phrased as a diagnosis or medical clearance. */
export function formatInjuriesForPrompt(injuries: InjurySummary[]): string | null {
  if (injuries.length === 0) return null;

  const lines = injuries.map((i) => {
    const sideText = i.side !== "NOT_APPLICABLE" ? ` (lato ${SIDE_LABEL_IT[i.side]})` : "";
    const parts = [`${TYPE_LABEL_IT[i.type]} — ${i.bodyRegion}${sideText}`, `stato: ${STATUS_LABEL_IT[i.status]}`];
    if (i.reportedLimitations) parts.push(`limitazioni riferite: "${i.reportedLimitations}"`);
    return `- ${parts.join(", ")}`;
  });

  return (
    "LIMITAZIONI FISICHE REGISTRATE (dati riferiti dal coach/atleta, NON diagnosi mediche — non inventare cause, gravità o tempi di recupero):\n" +
    lines.join("\n") +
    "\nAdatta gli esercizi evitando quelli chiaramente incompatibili con queste limitazioni riferite. Se non è chiaro come adattare un blocco, mantienilo ma segnalalo esplicitamente nella motivazione."
  );
}

/** Short note persisted on the generated TrainingSession and shown to the coach — combined with the Adaptive Training Engine's own note, if any. */
export function formatInjuryAdaptationNote(injuries: InjurySummary[]): string {
  const areas = injuries.map((i) => i.bodyRegion).join(", ");
  return `Sessione adattata per limitazioni fisiche registrate: ${areas}.`;
}

export type OverallInjuryStatus = "NONE" | "MONITORED" | "PARTIAL" | "ACTIVE_INJURY";

/**
 * The four states from master prompt §14 (🟢🟡🟠🔴) — a management
 * indicator of what's registered, explicitly not a medical clearance
 * signal (§20). Priority order when several episodes are active at once:
 * an active INFORTUNIO always wins (🔴), then a LIMITAZIONE (🟠), else
 * anything else active/monitored/returning is just "monitored" (🟡).
 */
export function computeOverallInjuryStatus(injuries: { type: InjuryType; status: InjuryStatus }[]): OverallInjuryStatus {
  const active = injuries.filter((i) => ACTIVE_INJURY_STATUSES.includes(i.status));
  if (active.length === 0) return "NONE";
  if (active.some((i) => i.type === "INFORTUNIO" && i.status === "ACTIVE")) return "ACTIVE_INJURY";
  if (active.some((i) => i.type === "LIMITAZIONE")) return "PARTIAL";
  return "MONITORED";
}
