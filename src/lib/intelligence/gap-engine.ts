import { GoogleGenAI } from "@google/genai";
import { withAiRetry } from "@/lib/ai-retry";
import { formatContextForPrompt, type IntelligenceContext } from "@/lib/intelligence/context";
import { STRONG_MODEL } from "@/lib/ai-model";

const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;
const MODEL = STRONG_MODEL;

export type MainGap = {
  hasEnoughData: boolean;
  objectiveTitle: string | null;
  current: string | null;
  target: string | null;
  unit: string | null;
  gapExplanation: string | null;
  priorityReason: string | null;
};

/**
 * Master prompt §13-14 (Performance Gap Engine): surfaces the ONE gap that
 * matters most right now, never an exhaustive list (§28's own test) — same
 * "one recommendation, not a report" framing as Next Best Action. Reuses the
 * existing Objective baseline/target/current/unit fields already in
 * IntelligenceContext.activeObjectives rather than inventing a parallel
 * target-tracking entity (§27). Only QUANTITATIVE objectives with a real
 * current AND target value are eligible — a qualitative goal or one nobody
 * has updated yet can't produce a measurable gap.
 */
export async function computeMainGap(context: IntelligenceContext, methodologyText?: string | null): Promise<MainGap> {
  const eligible = context.activeObjectives.filter((o) => o.kind === "QUANTITATIVE" && o.currentValue && o.targetValue);

  if (eligible.length === 0) {
    return { hasEnoughData: false, objectiveTitle: null, current: null, target: null, unit: null, gapExplanation: null, priorityReason: null };
  }

  if (!ai) throw new Error("AI not configured: GEMINI_API_KEY is missing.");

  const contextText = formatContextForPrompt(context);
  const methodologyBlock = methodologyText ? `\n\n${methodologyText}` : "";

  const response = await withAiRetry(() => ai.models.generateContent({
    model: MODEL,
    contents:
      "Sei un assistente che aiuta un allenatore a capire QUALE gap tra dove sta ora l'atleta e dove vuole arrivare conta di più adesso. " +
      "Guarda gli obiettivi attivi quantitativi (con un valore attuale e un target) elencati nel contesto e scegli SOLO IL PIÙ IMPORTANTE — " +
      "mai un elenco di tutti i gap. Considera l'urgenza (scadenza vicina, competizione imminente) e l'ampiezza del divario. Se il coach ha " +
      "dichiarato priorità metodologiche (sotto — es. tecnica prima della fisicità per atleti giovani), usale per decidere tra due gap altrimenti " +
      "comparabili.\n\n" +
      "Se nessun obiettivo quantitativo ha dati sufficienti per calcolare un gap reale, imposta hasEnoughData a false.\n\n" +
      "Scrivi in italiano.\n\n" +
      contextText +
      methodologyBlock,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          hasEnoughData: { type: "boolean" },
          objectiveTitle: { type: "string", description: "Titolo esatto dell'obiettivo scelto, tra quelli elencati. Stringa vuota se hasEnoughData è false." },
          current: { type: "string" },
          target: { type: "string" },
          unit: { type: "string" },
          gapExplanation: { type: "string", description: "Il divario in termini concreti (Attuale -> Target -> Gap)." },
          priorityReason: { type: "string", description: "Perché QUESTO gap conta più degli altri obiettivi attivi in questo momento." },
        },
        required: ["hasEnoughData", "objectiveTitle", "current", "target", "unit", "gapExplanation", "priorityReason"],
      },
    },
  }));

  try {
    const parsed = JSON.parse(response.text ?? "{}") as {
      hasEnoughData: boolean;
      objectiveTitle: string;
      current: string;
      target: string;
      unit: string;
      gapExplanation: string;
      priorityReason: string;
    };
    if (!parsed.hasEnoughData) {
      return { hasEnoughData: false, objectiveTitle: null, current: null, target: null, unit: null, gapExplanation: null, priorityReason: null };
    }
    return {
      hasEnoughData: true,
      objectiveTitle: parsed.objectiveTitle || null,
      current: parsed.current || null,
      target: parsed.target || null,
      unit: parsed.unit || null,
      gapExplanation: parsed.gapExplanation || null,
      priorityReason: parsed.priorityReason || null,
    };
  } catch (err) {
    console.error("Failed to parse main gap from Gemini", err, response.text);
    return { hasEnoughData: false, objectiveTitle: null, current: null, target: null, unit: null, gapExplanation: null, priorityReason: null };
  }
}
