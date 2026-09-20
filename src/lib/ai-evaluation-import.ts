import { GoogleGenAI } from "@google/genai";
import { withAiRetry } from "@/lib/ai-retry";
import type { GeneratedEvaluationCriteria, ScoreType } from "@/lib/ai-evaluation-criteria";
import { FAST_MODEL } from "@/lib/ai-model";

const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;
const MODEL = FAST_MODEL;

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

const RESPONSE_SCHEMA = {
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
                targetLevel: { type: "string", description: "Livello target/soglia per questo criterio, se indicato nel documento, altrimenti stringa vuota." },
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
} as const;

const IMPORT_INSTRUCTIONS =
  "Sei un assistente che legge la scheda di valutazione di un allenatore sportivo (caricata come documento o foto) e ne estrae " +
  "la STRUTTURA ESATTA. Questo è diverso dal creare una valutazione da zero: qui NON devi inventare né aggiungere criteri che non " +
  "sono presenti nel documento — riporta SOLO ciò che è effettivamente scritto o disegnato nel documento. " +
  "Identifica le categorie (es. Tecnica, Tattica, Fisico...) e per ciascuna i criteri elencati. Per ogni criterio deduci il tipo di " +
  "punteggio dal modo in cui è espresso nel documento (una scala numerica come 1-10 o 1-5, una percentuale, un tempo, ripetizioni, " +
  "un tasso di successo, o testo/giudizio qualitativo se non c'è un numero). Se il documento indica un livello target o una soglia " +
  "per un criterio, riportalo in targetLevel, altrimenti lascialo vuoto. Se il documento non è una scheda di valutazione o è illeggibile, " +
  "restituisci una lista di categorie vuota.";

/**
 * Master prompt §3-4 (upload coach's own evaluation sheet, AI understands the
 * STRUCTURE rather than just extracting text). Never invents — the review UI
 * lets the coach accept/edit/delete/add before anything is saved (§4), and
 * this function itself is instructed to only report what the source
 * actually contains.
 */
export async function parseEvaluationDocument(params: {
  sportName: string;
  sportContext?: string;
  text?: string;
  imageBase64?: string;
  imageMimeType?: string;
}): Promise<GeneratedEvaluationCriteria> {
  if (!ai) throw new Error("AI not configured: GEMINI_API_KEY is missing.");
  if (!params.text && !params.imageBase64) throw new Error("No document content provided.");

  const contextText = `${IMPORT_INSTRUCTIONS}\n\n${params.sportContext ? `${params.sportContext}\n\n` : ""}Sport: ${params.sportName}`;

  const contents = params.imageBase64
    ? [
        {
          role: "user" as const,
          parts: [{ text: contextText }, { inlineData: { mimeType: params.imageMimeType ?? "image/jpeg", data: params.imageBase64 } }],
        },
      ]
    : `${contextText}\n\nDocumento caricato dall'allenatore:\n"""${params.text}"""`;

  const response = await withAiRetry(() => ai.models.generateContent({
    model: MODEL,
    contents,
    config: { responseMimeType: "application/json", responseSchema: RESPONSE_SCHEMA },
  }));

  try {
    return JSON.parse(response.text ?? "") as GeneratedEvaluationCriteria;
  } catch (err) {
    console.error("Failed to parse imported evaluation document from Gemini", err, response.text);
    return { categories: [] };
  }
}
