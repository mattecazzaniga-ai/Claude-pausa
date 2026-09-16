import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;
const MODEL = "gemini-3.6-flash";

export type GeneratedMetric = { name: string; unit: string; description: string };
export type GeneratedSportMetrics = { metrics: GeneratedMetric[] };

/**
 * Generates the sport-specific performance metrics a coach would actually
 * track (master prompt §22, "Smart Metrics Engine") — e.g. pace/distance for
 * running, first-serve % for tennis. Deliberately just name/unit/description:
 * no invented thresholds or "scores" without a real statistical basis (§22's
 * own warning). Same lazy/cached pattern as the taxonomy and Sport Profile.
 */
export async function generateSportMetrics(sportName: string, sportContext: string): Promise<GeneratedSportMetrics> {
  if (!ai) throw new Error("AI not configured: GEMINI_API_KEY is missing.");

  const response = await ai.models.generateContent({
    model: MODEL,
    contents:
      "Sei un esperto di scienze dello sport. Elenca le metriche di performance che un allenatore o un atleta di questo sport monitora " +
      "realmente per capire se sta migliorando. Devono essere metriche concrete e misurabili in allenamento o in gara, non concetti astratti. " +
      "NON inventare punteggi/soglie scientificamente non validati: limitati a nome, unità di misura e una breve descrizione di cosa indica " +
      "la metrica. Usa solo metriche che appartengono davvero a questo sport specifico, non prese in prestito da uno sport simile ma diverso.\n\n" +
      `${sportContext}\n\n` +
      `Sport: ${sportName}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          metrics: {
            type: "array",
            maxItems: 8,
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                unit: { type: "string", description: "Unità di misura (es. 'min/km', '%', 'watt'). Stringa vuota se la metrica non ha un'unità." },
                description: { type: "string", description: "Cosa indica questa metrica, in breve." },
              },
              required: ["name", "unit", "description"],
            },
          },
        },
        required: ["metrics"],
      },
    },
  });

  try {
    return JSON.parse(response.text ?? "") as GeneratedSportMetrics;
  } catch (err) {
    console.error("Failed to parse sport metrics from Gemini", err, response.text);
    return { metrics: [] };
  }
}
