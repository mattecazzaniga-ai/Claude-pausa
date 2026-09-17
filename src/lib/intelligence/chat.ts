import { GoogleGenAI } from "@google/genai";
import { formatContextForPrompt, type IntelligenceContext } from "@/lib/intelligence/context";
import { STRONG_MODEL } from "@/lib/ai-model";

const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;
const MODEL = STRONG_MODEL;

const MAX_QUESTION_LENGTH = 500;
const MAX_HISTORY_TURNS = 6;

export type ChatTurn = { role: "coach" | "assistant"; text: string };

/**
 * The landing page's "Ask your Coaching AI" made real: grounded in the same
 * bounded IntelligenceContext the Next Best Action engine uses — never a
 * generic chatbot with no memory of the athlete. Answers as an assistant
 * TO the coach, never as a system that decides for them (§ landing copy
 * "AI che supporta il coach", never "decide al posto tuo").
 */
export async function answerCoachQuestion(context: IntelligenceContext, question: string, history: ChatTurn[]): Promise<string> {
  if (!ai) throw new Error("AI not configured: GEMINI_API_KEY is missing.");

  const contextText = formatContextForPrompt(context);
  const trimmedHistory = history.slice(-MAX_HISTORY_TURNS);
  const historyText = trimmedHistory.length
    ? "\n\nCronologia recente della conversazione:\n" +
      trimmedHistory.map((t) => `${t.role === "coach" ? "Allenatore" : "Tu"}: ${t.text}`).join("\n")
    : "";

  const response = await ai.models.generateContent({
    model: MODEL,
    contents:
      "Sei l'assistente AI di un allenatore sportivo all'interno di Mentathlos. Rispondi alla sua domanda su questo specifico atleta " +
      "usando SOLO i dati forniti sotto — non inventare mai sessioni, valutazioni, risultati o dettagli non presenti nel contesto.\n\n" +
      "REGOLE ASSOLUTE:\n" +
      "1. Sei un supporto alla decisione, non chi decide: proponi, suggerisci, evidenzia pattern — non affermare mai cosa l'allenatore " +
      "'deve' fare in modo perentorio. La decisione finale resta sempre sua.\n" +
      "2. Se i dati disponibili non bastano per rispondere con sicurezza, dillo esplicitamente invece di indovinare " +
      "(es. 'non ci sono ancora abbastanza sessioni registrate per dirlo con sicurezza').\n" +
      "3. Sii concreto e specifico, mai generico: fai riferimento a fatti reali del contesto quando li usi.\n" +
      "4. Rispondi in italiano, con un tono da collega esperto. Risposta breve (max 4-5 frasi o un elenco puntato breve), non un saggio.\n\n" +
      contextText +
      historyText +
      `\n\nDomanda dell'allenatore: "${question}"`,
  });

  return response.text?.trim() || "Non sono riuscito a generare una risposta. Riprova tra poco.";
}

export function isValidQuestion(question: unknown): question is string {
  return typeof question === "string" && question.trim().length > 0 && question.trim().length <= MAX_QUESTION_LENGTH;
}
