import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;
const MODEL = "gemini-3.6-flash";

export type CriterionComparison = {
  name: string;
  category: string;
  scoreType: string;
  baseline: string | null;
  previous: string | null;
  current: string | null;
};

export type EvaluationAnalysis = {
  narrative: string;
  priorities: { skill: string; reason: string }[];
};

/**
 * Master prompt §10-11: after a periodic evaluation, compare it against the
 * baseline/previous one and turn the deltas into a short narrative plus
 * concrete next-focus priorities — in the SAME shape as Athlete.aiPriorities,
 * so the result can be merged straight into the athlete's cached priorities
 * and immediately feed session generation and the "Cosa alleniamo oggi?"
 * widget. This is what closes the Evaluation -> Training loop instead of
 * evaluations being dead data.
 */
export async function analyzeEvaluationProgress(params: {
  subjectName: string;
  sportContext?: string;
  comparisons: CriterionComparison[];
  notes?: string;
}): Promise<EvaluationAnalysis> {
  if (!ai) throw new Error("AI not configured: GEMINI_API_KEY is missing.");

  const comparisonText = params.comparisons
    .filter((c) => c.current !== null)
    .map((c) => {
      const parts = [`Attuale: ${c.current}`];
      if (c.previous !== null) parts.push(`Precedente: ${c.previous}`);
      if (c.baseline !== null && c.baseline !== c.previous) parts.push(`Baseline: ${c.baseline}`);
      return `- [${c.category}] ${c.name} (${c.scoreType}): ${parts.join(", ")}`;
    })
    .join("\n");

  const response = await ai.models.generateContent({
    model: MODEL,
    contents:
      "Sei un assistente per allenatori sportivi che analizza una valutazione periodica confrontandola con quella precedente e con la baseline iniziale. " +
      "Individua pattern reali (miglioramenti, cali, stagnazione), non genericità. Sii specifico e concreto, tono da collega esperto. " +
      "Scrivi in italiano.\n\n" +
      `${params.sportContext ? `${params.sportContext}\n\n` : ""}` +
      `Soggetto valutato: ${params.subjectName}\n` +
      `${params.notes ? `Note dell'allenatore su questa valutazione: ${params.notes}\n` : ""}\n` +
      `Confronto criteri (dal più recente confrontato con precedente/baseline):\n${comparisonText}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          narrative: {
            type: "string",
            description: "2-4 frasi: cosa è migliorato, cosa è stagnante o peggiorato, confrontando con la valutazione precedente e la baseline.",
          },
          priorities: {
            type: "array",
            items: {
              type: "object",
              properties: {
                skill: { type: "string", description: "Nome del criterio/competenza su cui concentrarsi." },
                reason: { type: "string", description: "Perché è la priorità, basato sul confronto tra valutazioni." },
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
    return JSON.parse(response.text ?? "") as EvaluationAnalysis;
  } catch (err) {
    console.error("Failed to parse evaluation analysis from Gemini", err, response.text);
    return { narrative: "Non è stato possibile generare un'analisi.", priorities: [] };
  }
}
