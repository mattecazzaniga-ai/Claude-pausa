import { GoogleGenAI } from "@google/genai";
import { withAiRetry } from "@/lib/ai-retry";
import { formatContextForPrompt, type IntelligenceContext } from "@/lib/intelligence/context";
import { STRONG_MODEL } from "@/lib/ai-model";

const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;
const MODEL = STRONG_MODEL;

export type PerformanceLevelAssessment = {
  /** INSUFFICIENT_DATA when there isn't enough real evidence to say anything — never a guess dressed up as a level (master prompt §28's own test). */
  provenance: "INSUFFICIENT_DATA" | "ASSESSED";
  level: string | null;
  explanation: string | null;
  basedOn: string[];
};

/**
 * Master prompt §6-7 (dynamic Performance Level with provenance): estimates
 * where an athlete currently stands, using only real data already in the
 * Decision Engine context (evaluations, sport metrics, competitions, active
 * objectives) — never a fixed universal ladder, since what "advanced" means
 * is entirely sport- and context-dependent. Mirrors diagnoseBottleneck's own
 * discipline: a deterministic short-circuit before ever calling the AI, so
 * an athlete with no real history gets INSUFFICIENT_DATA rather than an
 * invented label, and one with a real track record is never flattened to
 * "beginner" by default.
 */
export async function assessPerformanceLevel(context: IntelligenceContext, methodologyText?: string | null): Promise<PerformanceLevelAssessment> {
  const hasEvidence =
    context.evaluationComparison.length > 0 ||
    context.recentCompetitions.length > 0 ||
    context.recentMetrics.length > 0 ||
    context.activeObjectives.some((o) => o.kind === "QUANTITATIVE" && o.currentValue);

  if (!hasEvidence) {
    return { provenance: "INSUFFICIENT_DATA", level: null, explanation: null, basedOn: [] };
  }

  if (!ai) throw new Error("AI not configured: GEMINI_API_KEY is missing.");

  const contextText = formatContextForPrompt(context);
  const methodologyBlock = methodologyText ? `\n\n${methodologyText}` : "";

  const response = await withAiRetry(() => ai.models.generateContent({
    model: MODEL,
    contents:
      "Sei un esperto di scienze dello sport. Stima il livello di performance ATTUALE di questo atleta, usando SOLO i dati forniti " +
      "(valutazioni, metriche sport-specifiche, competizioni, obiettivi attivi). Il livello è un'etichetta libera e specifica per questo sport " +
      "e questo atleta (es. 'principiante', 'intermedio con buona base tecnica', 'agonista regionale', 'competitivo a livello nazionale') — " +
      "NON usare una scala universale fissa e non forzare un atleta con un percorso reale in una categoria generica bassa solo per prudenza. " +
      "Se il coach ha dichiarato criteri propri su cosa considera un certo livello (sotto), tienine conto nell'etichetta.\n\n" +
      "Se i dati forniti sono troppo scarsi, contraddittori, o insufficienti per una stima ragionevole, imposta hasEnoughData a false e lascia " +
      "level/explanation vuoti — non inventare mai un livello per dare comunque una risposta.\n\n" +
      "Scrivi in italiano.\n\n" +
      contextText +
      methodologyBlock,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          hasEnoughData: { type: "boolean" },
          level: { type: "string", description: "Etichetta libera del livello attuale. Stringa vuota se hasEnoughData è false." },
          explanation: { type: "string", description: "Perché questo livello, in 1-3 frasi, citando i dati reali usati. Stringa vuota se hasEnoughData è false." },
          basedOn: { type: "array", items: { type: "string" }, description: "Elenco puntato dei fatti concreti usati per la stima." },
        },
        required: ["hasEnoughData", "level", "explanation", "basedOn"],
      },
    },
  }));

  try {
    const parsed = JSON.parse(response.text ?? "{}") as { hasEnoughData: boolean; level: string; explanation: string; basedOn: string[] };
    if (!parsed.hasEnoughData) return { provenance: "INSUFFICIENT_DATA", level: null, explanation: null, basedOn: [] };
    return { provenance: "ASSESSED", level: parsed.level || null, explanation: parsed.explanation || null, basedOn: parsed.basedOn ?? [] };
  } catch (err) {
    console.error("Failed to parse performance level assessment from Gemini", err, response.text);
    return { provenance: "INSUFFICIENT_DATA", level: null, explanation: null, basedOn: [] };
  }
}
