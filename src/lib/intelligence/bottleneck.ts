import { GoogleGenAI } from "@google/genai";
import { formatContextForPrompt, type IntelligenceContext } from "@/lib/intelligence/context";

const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;
const MODEL = "gemini-3.6-flash";

export type BottleneckDiagnosis = {
  hasEnoughData: boolean;
  evidence: string[];
  bottleneckHypothesis: string | null;
  recommendedExperiment: string | null;
};

/**
 * Master prompt §9 ("Why isn't he improving?"): a hypothesis, never a
 * diagnosis. The prompt itself enforces hedged language ("può indicare",
 * "vale la pena testare") rather than firm claims, and the function returns
 * hasEnoughData=false with no hypothesis when the evidence is too thin —
 * matching "there isn't enough data yet" instead of guessing.
 */
export async function diagnoseBottleneck(context: IntelligenceContext): Promise<BottleneckDiagnosis> {
  if (!ai) throw new Error("AI not configured: GEMINI_API_KEY is missing.");

  const contextText = formatContextForPrompt(context);

  const response = await ai.models.generateContent({
    model: MODEL,
    contents:
      "Sei un assistente che aiuta un allenatore a capire PERCHÉ un atleta non sta migliorando come atteso su una certa area. " +
      "Questa è un'ipotesi di lavoro, MAI una diagnosi certa. Usa sempre un linguaggio che segnala incertezza: " +
      "'può indicare', 'i dati suggeriscono', 'vale la pena testare' — mai affermazioni categoriche.\n\n" +
      "Analizza: frequenza di allenamento sulla stessa area, se il lavoro è stato ripetitivo/isolato invece che sotto pressione/in game, " +
      "il tempo tra le sessioni, se la stessa criticità è stata allenata ripetutamente senza cambiare approccio, il confronto tra progressi " +
      "tecnici (in allenamento) e trasferimento in competizione.\n\n" +
      "Se i dati forniti sono troppo scarsi per formulare un'ipotesi ragionevole (poche sessioni, nessuna valutazione), imposta " +
      "hasEnoughData a false e lascia bottleneckHypothesis/recommendedExperiment vuoti — non inventare un'ipotesi plausibile solo per dare una risposta.\n\n" +
      "Scrivi in italiano.\n\n" +
      contextText,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          hasEnoughData: { type: "boolean" },
          evidence: { type: "array", items: { type: "string" }, description: "Fatti concreti a supporto, tratti solo dai dati forniti." },
          bottleneckHypothesis: { type: "string", description: "L'ipotesi sul possibile blocco, con linguaggio da ipotesi. Stringa vuota se hasEnoughData è false." },
          recommendedExperiment: { type: "string", description: "Un cambiamento concreto da provare per verificare l'ipotesi. Stringa vuota se hasEnoughData è false." },
        },
        required: ["hasEnoughData", "evidence", "bottleneckHypothesis", "recommendedExperiment"],
      },
    },
  });

  try {
    const parsed = JSON.parse(response.text ?? "{}") as BottleneckDiagnosis;
    return {
      hasEnoughData: Boolean(parsed.hasEnoughData),
      evidence: parsed.evidence ?? [],
      bottleneckHypothesis: parsed.hasEnoughData ? parsed.bottleneckHypothesis || null : null,
      recommendedExperiment: parsed.hasEnoughData ? parsed.recommendedExperiment || null : null,
    };
  } catch (err) {
    console.error("Failed to parse bottleneck diagnosis from Gemini", err, response.text);
    return { hasEnoughData: false, evidence: [], bottleneckHypothesis: null, recommendedExperiment: null };
  }
}
