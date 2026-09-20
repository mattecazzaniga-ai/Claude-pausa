import { GoogleGenAI } from "@google/genai";
import { withAiRetry } from "@/lib/ai-retry";
import { FAST_MODEL } from "@/lib/ai-model";

const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;
const MODEL = FAST_MODEL;

const CATEGORY_ENUM = [
  "FILOSOFIA",
  "VOLUME",
  "INTENSITA",
  "RECUPERO",
  "PROGRESSIONE",
  "REGRESSIONE",
  "PERIODIZZAZIONE",
  "SCELTA_ESERCIZI",
  "ESERCIZI_PREFERITI",
  "ESERCIZI_DA_EVITARE",
  "PRE_COMPETIZIONE",
  "POST_COMPETIZIONE",
  "LIVELLI_ETA",
  "REGOLE_SPORT_SPECIFICHE",
  "ALTRO",
] as const;

export type MethodologyCategory = (typeof CATEGORY_ENUM)[number];
export type ParsedMethodology = { principles: { text: string; category: MethodologyCategory }[] };

/**
 * Master prompt §8-9: the coach writes or uploads free text describing how
 * they like to train, and the AI reads out only the principles actually
 * present — one short, concrete sentence per principle, never a paraphrase
 * that adds advice the coach didn't write. Text only (no images): a coach's
 * own written methodology is very unlikely to arrive as a photo, unlike an
 * evaluation sheet, so the extra vision-payload path isn't built for this.
 */
export async function parseMethodologyDocument(params: { text: string; sportName?: string }): Promise<ParsedMethodology> {
  if (!ai) throw new Error("AI not configured: GEMINI_API_KEY is missing.");
  if (!params.text.trim()) return { principles: [] };

  const response = await withAiRetry(() => ai.models.generateContent({
    model: MODEL,
    contents:
      "Un allenatore sportivo ha scritto o caricato un testo che descrive la propria metodologia/filosofia di allenamento. " +
      "Estrai SOLO i principi realmente presenti nel testo, come frasi brevi e concrete, uno per principio — riprendendo il senso " +
      "esatto di ciò che l'allenatore ha scritto. NON inventare principi assenti dal testo, NON aggiungere consigli sportivi generici " +
      "che non ci sono, NON generalizzare oltre quanto scritto. Se il testo è vago, troppo corto o non contiene principi riconoscibili, " +
      "restituisci una lista vuota.\n\n" +
      `${params.sportName ? `Sport dell'allenatore: ${params.sportName}\n\n` : ""}` +
      `Testo dell'allenatore:\n"""${params.text}"""`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          principles: {
            type: "array",
            items: {
              type: "object",
              properties: {
                text: { type: "string", description: "Il principio, come frase breve e concreta ripresa dal testo — non generico." },
                category: { type: "string", enum: CATEGORY_ENUM as unknown as string[] },
              },
              required: ["text", "category"],
            },
          },
        },
        required: ["principles"],
      },
    },
  }));

  try {
    const parsed = JSON.parse(response.text ?? "") as ParsedMethodology;
    return { principles: (parsed.principles ?? []).filter((p) => p.text?.trim()) };
  } catch (err) {
    console.error("Failed to parse imported methodology document from Gemini", err, response.text);
    return { principles: [] };
  }
}
