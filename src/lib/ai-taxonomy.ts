import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;
const MODEL = "gemini-2.5-flash";

export type GeneratedTaxonomy = { categories: { name: string; skills: string[] }[] };

/**
 * Generates a skill taxonomy (Tecnica/Tattica/Fisico/... -> specific skills)
 * for a sport that doesn't have one yet. Called once per sport, lazily, the
 * first time a coach actually needs it (an exercise or session for that
 * sport) — not hand-authored for every sport in the picker up front. The
 * result is persisted, so this only ever runs once per sport, system-wide.
 */
export async function generateSportTaxonomy(sportName: string): Promise<GeneratedTaxonomy> {
  if (!ai) throw new Error("AI not configured: GEMINI_API_KEY is missing.");

  const response = await ai.models.generateContent({
    model: MODEL,
    contents:
      `Sei un esperto di metodologia dell'allenamento per molti sport. Crea una tassonomia di valutazione per il seguente sport, ` +
      `pensata per un allenatore che vuole valutare e sviluppare i propri atleti. Usa terminologia tecnica corretta e specifica per questo sport ` +
      `(non generica). Includi normalmente categorie come Tecnica, Tattica, Fisico, e se rilevante per lo sport anche Mentale o altre categorie sport-specifiche. ` +
      `Ogni categoria deve avere 4-8 competenze specifiche, concrete, osservabili durante un allenamento.\n\n` +
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
                skills: { type: "array", items: { type: "string" } },
              },
              required: ["name", "skills"],
            },
          },
        },
        required: ["categories"],
      },
    },
  });

  try {
    return JSON.parse(response.text ?? "") as GeneratedTaxonomy;
  } catch (err) {
    console.error("Failed to parse sport taxonomy from Gemini", err, response.text);
    return { categories: [] };
  }
}
