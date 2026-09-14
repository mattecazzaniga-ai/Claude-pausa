import { GoogleGenAI } from "@google/genai";
import { prisma } from "@/lib/prisma";
import type { Prisma, CoachFeedbackSignalType } from "@prisma/client";

const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;
const MODEL = "gemini-3.6-flash";

const MIN_SIGNALS_FOR_SYNTHESIS = 5;
const SIGNALS_FOR_SYNTHESIS = 30;
const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000;

type LearnedPreference = { insight: string; evidenceCount: number; category: string };

/**
 * Master prompt §10-11: log one moment a coach accepted, rejected, or
 * adjusted something the AI proposed. Fire-and-forget by design — a failure
 * here must never break the feature that produced the signal.
 */
export async function recordCoachFeedbackSignal(
  coachId: string,
  type: CoachFeedbackSignalType,
  summary: string,
  detail?: Record<string, unknown>,
) {
  try {
    await prisma.coachFeedbackSignal.create({
      data: { coachId, type, summary, detail: (detail as Prisma.InputJsonValue) ?? undefined },
    });
  } catch (err) {
    console.error("Failed to record coach feedback signal", err);
  }
}

/**
 * Lazy cache-filler (same pattern as ensureSportProfile): recomputes
 * Coach.learnedPreferences from the signal log when there's enough evidence
 * and the cache is stale, and silently no-ops on any failure — this must
 * never block or break Next Best Action generation.
 */
export async function refreshCoachBrainIfStale(coachId: string): Promise<void> {
  if (!ai) return;

  try {
    const coach = await prisma.coach.findUnique({
      where: { id: coachId },
      select: { learnedPreferencesUpdatedAt: true },
    });
    if (!coach) return;

    if (coach.learnedPreferencesUpdatedAt && Date.now() - coach.learnedPreferencesUpdatedAt.getTime() < REFRESH_INTERVAL_MS) {
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

    const response = await ai.models.generateContent({
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
    });

    const parsed = JSON.parse(response.text ?? "{}") as { preferences?: LearnedPreference[] };
    const preferences = parsed.preferences ?? [];

    await prisma.coach.update({
      where: { id: coachId },
      data: { learnedPreferences: preferences as unknown as Prisma.InputJsonValue, learnedPreferencesUpdatedAt: new Date() },
    });
  } catch (err) {
    console.error("Coach Brain refresh failed, leaving previous cache in place", err);
  }
}

/**
 * Formats cached learned preferences for injection into an AI prompt as
 * additional context — never as a command that overrides athlete facts.
 * Returns null when there isn't a synthesized profile yet.
 */
export async function getCoachBrainPromptText(coachId: string): Promise<string | null> {
  const coach = await prisma.coach.findUnique({ where: { id: coachId }, select: { learnedPreferences: true } });
  const preferences = (coach?.learnedPreferences as unknown as LearnedPreference[] | null) ?? null;
  if (!preferences || preferences.length === 0) return null;

  return preferences.map((p) => `- ${p.insight} (osservato ${p.evidenceCount} volte)`).join("\n");
}
