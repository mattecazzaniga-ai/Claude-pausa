import { GoogleGenAI } from "@google/genai";
import { withAiRetry } from "@/lib/ai-retry";
import { STRONG_MODEL } from "@/lib/ai-model";

const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;
const MODEL = STRONG_MODEL;

export type ScoreType =
  | "SCALE_1_5"
  | "SCALE_1_10"
  | "PERCENTAGE"
  | "TIME_SECONDS"
  | "DISTANCE_METERS"
  | "REPETITIONS"
  | "SUCCESS_RATE"
  | "CUSTOM_NUMERIC"
  | "QUALITATIVE";

export type GeneratedCriterion = { name: string; scoreType: ScoreType; targetLevel: string };
export type GeneratedEvaluationCriteria = { categories: { name: string; criteria: GeneratedCriterion[] }[] };

const SCORE_TYPE_ENUM: ScoreType[] = [
  "SCALE_1_5",
  "SCALE_1_10",
  "PERCENTAGE",
  "TIME_SECONDS",
  "DISTANCE_METERS",
  "REPETITIONS",
  "SUCCESS_RATE",
  "CUSTOM_NUMERIC",
  "QUALITATIVE",
];

/**
 * Generates the default (sport-wide, shared) evaluation dimensions for a
 * sport's initial/periodic assessments — master prompt §5. Same lazy/cached
 * pattern as generateSportTaxonomy: called once per sport the first time a
 * coach needs it, then persisted as EvaluationCriterion rows with
 * coachId=null. Coaches can additionally define their own custom criteria
 * (see master prompt §6) alongside these.
 */
export async function generateEvaluationCriteria(sportName: string): Promise<GeneratedEvaluationCriteria> {
  if (!ai) throw new Error("AI not configured: GEMINI_API_KEY is missing.");

  const response = await withAiRetry(() => ai.models.generateContent({
    model: MODEL,
    contents:
      "Sei un esperto di valutazione tecnica per molti sport. Crea un set di criteri di valutazione iniziale/periodica per il seguente sport, " +
      "pensato per un allenatore che deve misurare il livello di un atleta o di una squadra nel tempo. Organizza i criteri in categorie " +
      "(es. Tecnica, Tattica, Fisico, e se rilevante Mentale/Posizionamento/altro specifico per lo sport). Ogni categoria deve avere 3-6 criteri " +
      "concreti e osservabili. Per ogni criterio scegli il tipo di punteggio più adatto (scala 1-5, scala 1-10, percentuale, tempo in secondi, " +
      "distanza in metri, ripetizioni, tasso di successo, valore numerico personalizzato, o valutazione qualitativa) — non forzare tutto su una scala 1-10.\n\n" +
      "ATTENZIONE — ERRORE DA EVITARE: non confondere questo sport con sport simili (es. Beach Tennis vs Padel vs Tennis; Calcio a 5 vs Calcio). " +
      "Usa solo criteri, gesti tecnici e terminologia che appartengono davvero a QUESTO sport specifico.\n\n" +
      `Sport: ${sportName}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          categories: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                criteria: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      scoreType: { type: "string", enum: SCORE_TYPE_ENUM },
                      targetLevel: { type: "string", description: "Breve descrizione di cosa significa un livello buono/target per questo criterio." },
                    },
                    required: ["name", "scoreType", "targetLevel"],
                  },
                },
              },
              required: ["name", "criteria"],
            },
          },
        },
        required: ["categories"],
      },
    },
  }));

  try {
    return JSON.parse(response.text ?? "") as GeneratedEvaluationCriteria;
  } catch (err) {
    console.error("Failed to parse evaluation criteria from Gemini", err, response.text);
    return { categories: [] };
  }
}
