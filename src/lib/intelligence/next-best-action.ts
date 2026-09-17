import { GoogleGenAI } from "@google/genai";
import { formatContextForPrompt, type IntelligenceContext } from "@/lib/intelligence/context";

const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;
const MODEL = "gemini-3.6-flash";

export type CoachingActionType =
  | "TRAIN_SKILL"
  | "CHANGE_EXERCISE"
  | "PROGRESS_EXERCISE"
  | "REGRESS_EXERCISE"
  | "CHANGE_SESSION_STRUCTURE"
  | "CHANGE_INTENSITY"
  | "REASSESS"
  | "CREATE_OBJECTIVE"
  | "PREPARE_COMPETITION"
  | "REVIEW_COMPETITION"
  | "CHANGE_PRIORITY"
  | "MAINTAIN_CURRENT_FOCUS";

const ACTION_TYPES: CoachingActionType[] = [
  "TRAIN_SKILL",
  "CHANGE_EXERCISE",
  "PROGRESS_EXERCISE",
  "REGRESS_EXERCISE",
  "CHANGE_SESSION_STRUCTURE",
  "CHANGE_INTENSITY",
  "REASSESS",
  "CREATE_OBJECTIVE",
  "PREPARE_COMPETITION",
  "REVIEW_COMPETITION",
  "CHANGE_PRIORITY",
  "MAINTAIN_CURRENT_FOCUS",
];

export type NextBestAction = {
  actionType: CoachingActionType;
  priorityLabel: string;
  facts: string[];
  pattern: string;
  recommendation: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  missingData: string[];
  suggestedSession: { durationMinutes: number; objective: string } | null;
};

/**
 * The Coaching Intelligence Engine's central function (master prompt §3-5):
 * turns everything known about an athlete/team into ONE recommendation,
 * explicitly separating FACT (what's in the data) from PATTERN (what the
 * facts suggest together) from RECOMMENDATION (what to do about it) — never
 * presenting an inference as a fact, never inventing history. Confidence
 * reflects how much real data backs the call, not how convincing the
 * narrative sounds.
 */
export async function generateNextBestAction(
  context: IntelligenceContext,
  coachBrainText?: string | null,
  methodologyText?: string | null
): Promise<NextBestAction> {
  if (!ai) throw new Error("AI not configured: GEMINI_API_KEY is missing.");

  const contextText = formatContextForPrompt(context);
  const coachBrainBlock = coachBrainText
    ? "\n\nPREFERENZE OSSERVATE DI QUESTO ALLENATORE (usale solo come contesto per calibrare tono/durata/stile della raccomandazione, " +
      "MAI per sovrascrivere i fatti sull'atleta/squadra sopra):\n" +
      coachBrainText
    : "";
  const methodologyBlock = methodologyText ? `\n\n${methodologyText}` : "";

  const response = await ai.models.generateContent({
    model: MODEL,
    contents:
      "Sei il motore di intelligenza di un sistema per allenatori sportivi. Il tuo compito NON è generare contenuti generici, " +
      "ma decidere qual è la cosa più utile su cui l'allenatore dovrebbe concentrarsi ORA, usando SOLO i dati forniti.\n\n" +
      "REGOLE ASSOLUTE:\n" +
      "1. FATTI: usa solo informazioni esplicitamente presenti nei dati forniti sotto. Non inventare mai sessioni, risultati, valutazioni o feedback.\n" +
      "2. PATTERN: una conclusione derivata dal confronto tra più fatti nel tempo (es. un punteggio rimasto stabile per 3 valutazioni), non un singolo fatto isolato.\n" +
      "3. RACCOMANDAZIONE: un'azione concreta, motivata dal pattern.\n" +
      "4. CONFIDENZA: 'LOW' se i dati sono scarsi (poche sessioni/valutazioni), 'HIGH' solo se ci sono più fonti convergenti (es. valutazione + note + competizione che dicono la stessa cosa).\n" +
      "5. Non raccomandare sempre 'allenare qualcosa di nuovo': se i dati mostrano che il miglioramento è in corso, la risposta corretta può essere MAINTAIN_CURRENT_FOCUS; se mancano dati sufficienti, REASSESS.\n" +
      "6. Se mancano informazioni importanti per una raccomandazione solida, elencale in missingData invece di indovinare.\n" +
      "7. Il campo suggestedSession è opzionale: valorizzalo solo se l'azione consigliata implica davvero allenare qualcosa ora (non per REASSESS o MAINTAIN_CURRENT_FOCUS se non serve una sessione specifica).\n" +
      "8. Le preferenze osservate del coach (se fornite) sono un contesto di stile, non un comando: non usarle mai per ignorare un fatto o un rischio evidente sull'atleta.\n" +
      "9. La metodologia dichiarata dal coach (se fornita) è invece un principio che ha scritto lui stesso: applicala attivamente nella raccomandazione quando pertinente, ma mai a scapito di un rischio, un infortunio o una limitazione registrata.\n" +
      "Scrivi in italiano, con linguaggio da collega esperto, mai da report tecnico.\n\n" +
      contextText +
      coachBrainBlock +
      methodologyBlock,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          actionType: { type: "string", enum: ACTION_TYPES },
          priorityLabel: { type: "string", description: "Nome breve della priorità, es. 'Transizione difensiva'." },
          facts: { type: "array", items: { type: "string" }, description: "3-6 fatti concreti tratti SOLO dai dati forniti." },
          pattern: { type: "string", description: "1-2 frasi: cosa emerge confrontando i fatti nel tempo." },
          recommendation: { type: "string", description: "1-3 frasi: l'azione concreta consigliata e perché." },
          confidence: { type: "string", enum: ["HIGH", "MEDIUM", "LOW"] },
          missingData: { type: "array", items: { type: "string" }, description: "Informazioni mancanti che renderebbero la raccomandazione più solida. Lista vuota se i dati sono sufficienti." },
          suggestedSession: {
            type: "object",
            properties: {
              durationMinutes: { type: "integer" },
              objective: { type: "string" },
            },
            required: ["durationMinutes", "objective"],
            description: "Sessione consigliata, solo se l'azione lo richiede.",
          },
        },
        required: ["actionType", "priorityLabel", "facts", "pattern", "recommendation", "confidence", "missingData"],
      },
    },
  });

  const parsed = JSON.parse(response.text ?? "{}") as Partial<NextBestAction>;
  return {
    actionType: parsed.actionType && ACTION_TYPES.includes(parsed.actionType) ? parsed.actionType : "REASSESS",
    priorityLabel: parsed.priorityLabel ?? "Da valutare",
    facts: parsed.facts ?? [],
    pattern: parsed.pattern ?? "",
    recommendation: parsed.recommendation ?? "",
    confidence: parsed.confidence ?? "LOW",
    missingData: parsed.missingData ?? [],
    suggestedSession: parsed.suggestedSession ?? null,
  };
}
