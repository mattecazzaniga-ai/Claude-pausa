import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;
const MODEL = "gemini-3.6-flash";

export type CompetitionAnalysis = {
  narrative: string;
  priorities: { skill: string; reason: string }[];
};

/**
 * Master prompt §20-21 ("What did we learn?" / Competition -> Training
 * loop): turns a recorded result + the coach's own notes into a short
 * analysis and concrete next-focus priorities, in the same shape as
 * Athlete.aiPriorities so it can feed straight back into session generation
 * and the "Cosa alleniamo oggi?" widget. Never invents statistics — only
 * uses what the coach actually recorded.
 */
export async function analyzeCompetitionPerformance(params: {
  subjectName: string;
  sportContext?: string;
  competitionName: string;
  opponent?: string | null;
  result: string;
  score?: string | null;
  preNotes?: string | null;
  postNotes?: string | null;
}): Promise<CompetitionAnalysis> {
  if (!ai) throw new Error("AI not configured: GEMINI_API_KEY is missing.");

  const response = await ai.models.generateContent({
    model: MODEL,
    contents:
      "Sei un assistente per allenatori sportivi che analizza il risultato di una competizione appena disputata. " +
      "Usa SOLO le informazioni fornite dall'allenatore qui sotto — non inventare statistiche, azioni di gioco o dettagli non menzionati. " +
      "Se le note sono scarse, dai comunque un'analisi utile ma onesta sui limiti di quello che puoi dedurre. Tono da collega esperto, in italiano.\n\n" +
      `${params.sportContext ? `${params.sportContext}\n\n` : ""}` +
      `Soggetto: ${params.subjectName}\n` +
      `Competizione: ${params.competitionName}${params.opponent ? ` contro ${params.opponent}` : ""}\n` +
      `Risultato: ${params.result}${params.score ? ` (${params.score})` : ""}\n` +
      `${params.preNotes ? `Obiettivi/preparazione pre-gara: ${params.preNotes}\n` : ""}` +
      `${params.postNotes ? `Osservazioni dell'allenatore dopo la gara: ${params.postNotes}\n` : "(nessuna osservazione post-gara registrata)\n"}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          narrative: {
            type: "string",
            description: "2-4 frasi: cosa ha funzionato, cosa no, cosa emerge di rilevante per l'allenamento futuro. Basato solo sui dati forniti.",
          },
          priorities: {
            type: "array",
            items: {
              type: "object",
              properties: {
                skill: { type: "string", description: "Nome della competenza/area su cui concentrarsi." },
                reason: { type: "string", description: "Perché, collegato a quanto osservato in gara." },
              },
              required: ["skill", "reason"],
            },
          },
        },
        required: ["narrative", "priorities"],
      },
    },
  });

  try {
    return JSON.parse(response.text ?? "") as CompetitionAnalysis;
  } catch (err) {
    console.error("Failed to parse competition analysis from Gemini", err, response.text);
    return { narrative: "Non è stato possibile generare un'analisi.", priorities: [] };
  }
}
