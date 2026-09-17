import { GoogleGenAI } from "@google/genai";
import { STRONG_MODEL } from "@/lib/ai-model";

const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;
const MODEL = STRONG_MODEL;

export type SkillCategoryType = "TECHNICAL" | "TACTICAL" | "PHYSICAL" | "MENTAL" | "OTHER";
export type GeneratedTaxonomy = { categories: { name: string; type: SkillCategoryType; skills: string[] }[] };

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
      `(non generica). Organizza le competenze in categorie classificate per tipo: TECHNICAL (gesti/colpi/fondamentali), TACTICAL ` +
      `(posizionamento, lettura del gioco, decisioni), PHYSICAL (qualità atletiche specifiche per questo sport, non generiche), e se ` +
      `rilevante MENTAL o OTHER per aspetti sport-specifici che non rientrano nelle prime tre. Crea 2-4 categorie per ciascun tipo rilevante ` +
      `per questo sport (non tutti i tipi sono sempre rilevanti). ` +
      `Ogni categoria deve avere 4-8 competenze specifiche, concrete, osservabili durante un allenamento. ` +
      `Attenzione a non confondere questo sport con sport simili (es. Beach Tennis vs Padel vs Tennis): usa solo nomi di colpi/competenze che ` +
      `appartengono davvero a questo sport, mai presi in prestito da uno sport affine.\n\n` +
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
                type: { type: "string", enum: ["TECHNICAL", "TACTICAL", "PHYSICAL", "MENTAL", "OTHER"] },
                skills: { type: "array", items: { type: "string" } },
              },
              required: ["name", "type", "skills"],
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
