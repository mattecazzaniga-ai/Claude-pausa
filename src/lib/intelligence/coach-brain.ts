import { GoogleGenAI } from "@google/genai";
import { withAiRetry } from "@/lib/ai-retry";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type { CoachFeedbackSignalType, CoachPreferenceCategory, CoachPreferenceReviewState } from "@prisma/client";
import { slugify } from "@/lib/sport";
import { STRONG_MODEL } from "@/lib/ai-model";

const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;
const MODEL = STRONG_MODEL;

const MIN_SIGNALS_FOR_SYNTHESIS = 5;
const SIGNALS_FOR_SYNTHESIS = 30;
const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000;

type SynthesizedPreference = { insight: string; evidenceCount: number; category: CoachPreferenceCategory };

/**
 * Master prompt §10-11: log one moment a coach accepted, rejected, or
 * adjusted something the AI proposed. Fire-and-forget by design — a failure
 * here must never break the feature that produced the signal. athleteId/
 * teamId are tagged when the signal came from working with a specific one,
 * so it can later be found and removed if that athlete/team is deleted and
 * the coach asks to forget it (see forgetAthleteMemory/forgetTeamMemory).
 */
export async function recordCoachFeedbackSignal(
  coachId: string,
  type: CoachFeedbackSignalType,
  summary: string,
  detail?: Record<string, unknown>,
  scope?: { athleteId?: string; teamId?: string },
) {
  try {
    await prisma.coachFeedbackSignal.create({
      data: {
        coachId,
        type,
        summary,
        detail: (detail as Prisma.InputJsonValue) ?? undefined,
        athleteId: scope?.athleteId,
        teamId: scope?.teamId,
      },
    });
  } catch (err) {
    console.error("Failed to record coach feedback signal", err);
  }
}

/**
 * If too few signals are left to support any pattern, clear the AI's own
 * unconfirmed inferences (ACTIVE) and any past rejections (REJECTED) — but
 * never a CONFIRMED preference, since that's a deliberate coach action, not
 * a fragile inference tied to how much signal volume currently exists.
 * refreshCoachBrainIfStale on its own only ever recomputes/strengthens, it
 * never clears — clearing only happens here, when evidence genuinely
 * disappears (e.g. the athlete/team it came from was deleted).
 */
async function invalidateCoachBrain(coachId: string): Promise<void> {
  const signalCount = await prisma.coachFeedbackSignal.count({ where: { coachId } });

  if (signalCount < MIN_SIGNALS_FOR_SYNTHESIS) {
    await prisma.coachLearnedPreference.deleteMany({ where: { coachId, reviewState: { not: "CONFIRMED" } } });
    await prisma.coach.update({ where: { id: coachId }, data: { coachBrainRefreshedAt: null } });
    return;
  }

  await prisma.coach.update({ where: { id: coachId }, data: { coachBrainRefreshedAt: null } });
}

/**
 * Called when a coach deletes an athlete/team and explicitly asks to also
 * forget what the Coach Brain learned from them. Removes only the signals
 * tagged to it — signals recorded before this tagging existed aren't
 * attributable to any one athlete/team and are left alone — then
 * invalidates the synthesis so future recommendations stop reflecting it.
 */
export async function forgetAthleteMemory(coachId: string, athleteId: string): Promise<void> {
  await prisma.coachFeedbackSignal.deleteMany({ where: { coachId, athleteId } });
  await invalidateCoachBrain(coachId);
}

export async function forgetTeamMemory(coachId: string, teamId: string): Promise<void> {
  await prisma.coachFeedbackSignal.deleteMany({ where: { coachId, teamId } });
  await invalidateCoachBrain(coachId);
}

/**
 * Lazy cache-filler (same pattern as ensureSportProfile): resynthesizes the
 * coach's behavioral preferences from the signal log when there's enough
 * evidence and the last synthesis is stale, and silently no-ops on any
 * failure — this must never block or break Next Best Action generation.
 *
 * Each returned insight is grouped by a slugified topic key (same
 * topic-key-dedup convention as AthleteMemory/TeamMemory) so a recurring
 * pattern strengthens the same row (evidenceCount++) instead of duplicating
 * it. A REJECTED topic is never resurrected by resynthesis (§9-11: the
 * coach's rejection stands until they explicitly reactivate it); a
 * CONFIRMED topic keeps its confirmed state — resynthesis can refine its
 * wording/evidence count but never revert it back to a mere inference. A
 * topic that used to be ACTIVE but isn't returned this cycle (no longer
 * supported by recent signals) is dropped — confirmed/rejected ones are not.
 */
export async function refreshCoachBrainIfStale(coachId: string): Promise<void> {
  if (!ai) return;

  try {
    const coach = await prisma.coach.findUnique({
      where: { id: coachId },
      select: { coachBrainRefreshedAt: true },
    });
    if (!coach) return;

    if (coach.coachBrainRefreshedAt && Date.now() - coach.coachBrainRefreshedAt.getTime() < REFRESH_INTERVAL_MS) {
      return;
    }

    const signalCount = await prisma.coachFeedbackSignal.count({ where: { coachId } });
    if (signalCount < MIN_SIGNALS_FOR_SYNTHESIS) return;

    const signals = await prisma.coachFeedbackSignal.findMany({
      where: { coachId },
      orderBy: { createdAt: "desc" },
      take: SIGNALS_FOR_SYNTHESIS,
    });

    const signalsText = signals.map((s) => `- [${s.type}] ${s.summary}`).join("\n");

    const response = await withAiRetry(() => ai.models.generateContent({
      model: MODEL,
      contents:
        "Osservi come un allenatore reagisce nel tempo alle proposte di un sistema AI di coaching (raccomandazioni accettate/rifiutate, " +
        "sessioni valutate, esercizi sostituiti). Il tuo compito è individuare pattern REALI nel suo modo di lavorare, per aiutare il " +
        "sistema ad adattarsi a lui in futuro.\n\n" +
        "REGOLE:\n" +
        "1. Usa SOLO i segnali forniti sotto. Non inventare comportamenti non osservati.\n" +
        "2. Ogni preferenza deve essere supportata da almeno 2 segnali coerenti tra loro. Se i segnali sono troppo pochi, " +
        "contraddittori o non mostrano un pattern chiaro, restituisci una lista vuota — non forzare un'osservazione debole.\n" +
        "3. Scrivi ogni insight come un'osservazione comportamentale concreta (es. 'Tende a preferire sedute più brevi di quanto " +
        "suggerito dal sistema'), mai come un giudizio sull'allenatore.\n" +
        "4. category deve essere una di: INTENSITY, DURATION, EXERCISE_STYLE, COMMUNICATION, OTHER.\n" +
        "Scrivi in italiano.\n\n" +
        `SEGNALI OSSERVATI (dal più recente):\n${signalsText}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            preferences: {
              type: "array",
              maxItems: 5,
              items: {
                type: "object",
                properties: {
                  insight: { type: "string" },
                  evidenceCount: { type: "integer" },
                  category: { type: "string", enum: ["INTENSITY", "DURATION", "EXERCISE_STYLE", "COMMUNICATION", "OTHER"] },
                },
                required: ["insight", "evidenceCount", "category"],
              },
            },
          },
          required: ["preferences"],
        },
      },
    }));

    const parsed = JSON.parse(response.text ?? "{}") as { preferences?: SynthesizedPreference[] };
    const preferences = parsed.preferences ?? [];

    const existing = await prisma.coachLearnedPreference.findMany({ where: { coachId } });
    const existingByTopic = new Map(existing.map((p) => [p.topic, p]));
    const newTopics = new Set<string>();

    for (const pref of preferences) {
      const topic = slugify(pref.insight);
      if (!topic) continue;
      newTopics.add(topic);
      const current = existingByTopic.get(topic);

      if (current?.reviewState === "REJECTED") continue; // honor the coach's rejection — never resurrect silently

      if (current) {
        await prisma.coachLearnedPreference.update({
          where: { id: current.id },
          data: { insight: pref.insight, category: pref.category, evidenceCount: pref.evidenceCount },
          // reviewState untouched: stays ACTIVE or stays CONFIRMED, never reverted
        });
      } else {
        await prisma.coachLearnedPreference.create({
          data: { coachId, topic, insight: pref.insight, category: pref.category, evidenceCount: pref.evidenceCount },
        });
      }
    }

    // Drop ACTIVE topics no longer supported by this synthesis — CONFIRMED and REJECTED rows are left alone.
    await prisma.coachLearnedPreference.deleteMany({
      where: { coachId, reviewState: "ACTIVE", topic: { notIn: [...newTopics] } },
    });

    await prisma.coach.update({ where: { id: coachId }, data: { coachBrainRefreshedAt: new Date() } });
  } catch (err) {
    console.error("Coach Brain refresh failed, leaving previous state in place", err);
  }
}

const CATEGORY_LABEL: Record<CoachPreferenceCategory, string> = {
  INTENSITY: "Intensità",
  DURATION: "Durata",
  EXERCISE_STYLE: "Stile di esercizi",
  COMMUNICATION: "Comunicazione",
  OTHER: "Altro",
};

export type LearnedPreferenceView = {
  id: string;
  insight: string;
  category: CoachPreferenceCategory;
  categoryLabel: string;
  evidenceCount: number;
  reviewState: CoachPreferenceReviewState;
  updatedAt: string;
};

/** Everything the coach can see/act on for "Il mio Coach Brain" — ACTIVE + CONFIRMED first, REJECTED kept visible so a reject can be undone. */
export async function getCoachLearnedPreferences(coachId: string): Promise<LearnedPreferenceView[]> {
  const rows = await prisma.coachLearnedPreference.findMany({
    where: { coachId },
    orderBy: [{ reviewState: "asc" }, { evidenceCount: "desc" }],
  });
  return rows.map((r) => ({
    id: r.id,
    insight: r.insight,
    category: r.category,
    categoryLabel: CATEGORY_LABEL[r.category],
    evidenceCount: r.evidenceCount,
    reviewState: r.reviewState,
    updatedAt: r.updatedAt.toISOString(),
  }));
}

/** §10: the only path to CONFIRMED — an explicit coach action, never an automatic promotion. */
export async function confirmCoachPreference(id: string, coachId: string): Promise<void> {
  await prisma.coachLearnedPreference.updateMany({ where: { id, coachId }, data: { reviewState: "CONFIRMED" } });
}

/** §24: rejecting keeps the row (never deleted) but excludes it from prompts and from future resynthesis under the same topic. */
export async function rejectCoachPreference(id: string, coachId: string): Promise<void> {
  await prisma.coachLearnedPreference.updateMany({ where: { id, coachId }, data: { reviewState: "REJECTED" } });
}

/** Nothing here is irreversible: undoes a reject, putting the insight back into active use/resynthesis. */
export async function reactivateCoachPreference(id: string, coachId: string): Promise<void> {
  await prisma.coachLearnedPreference.updateMany({ where: { id, coachId }, data: { reviewState: "ACTIVE" } });
}

const CONFIDENCE_HEDGE: Record<CoachPreferenceReviewState, (insight: string) => string> = {
  ACTIVE: (s) => `${s} (pattern osservato, non confermato)`,
  CONFIRMED: (s) => `${s} (confermato dal coach)`,
  REJECTED: (s) => s, // never reached — excluded from the query below
};

/**
 * Formats learned preferences for injection into an AI prompt as additional
 * context — never as a command that overrides athlete facts, and always
 * hedged unless the coach explicitly confirmed it (§9-10).
 */
export async function getCoachBrainPromptText(coachId: string): Promise<string | null> {
  const preferences = await prisma.coachLearnedPreference.findMany({
    where: { coachId, reviewState: { in: ["ACTIVE", "CONFIRMED"] } },
    orderBy: [{ reviewState: "desc" }, { evidenceCount: "desc" }],
  });
  if (preferences.length === 0) return null;

  return preferences.map((p) => `- ${CONFIDENCE_HEDGE[p.reviewState](p.insight)}`).join("\n");
}
