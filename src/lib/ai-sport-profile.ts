import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;
const MODEL = "gemini-3.6-flash";

export type GeneratedSportProfile = {
  formats: ("INDIVIDUAL" | "PAIR" | "TEAM")[];
  environment: string;
  equipment: string;
  scoringSystem: string;
  keyRules: string;
  terminology: string;
};

/**
 * Generates the "Sport Profile" — the context that makes AI-generated notes,
 * exercises and sessions genuinely sport-specific instead of generic content
 * with the sport's name swapped in. Called once per sport, lazily, the first
 * time a coach actually needs it — same pattern as generateSportTaxonomy.
 */
export async function generateSportProfile(sportName: string): Promise<GeneratedSportProfile> {
  if (!ai) throw new Error("AI not configured: GEMINI_API_KEY is missing.");

  const response = await ai.models.generateContent({
    model: MODEL,
    contents:
      "Sei un esperto di questo sport, che deve fornire un profilo di riferimento a un motore AI che genererà esercizi e sessioni di allenamento. " +
      "Il profilo deve permettere di distinguere nettamente questo sport da tutti gli altri: niente di generico o riusabile per un altro sport. " +
      "Sii concreto e specifico: campo/superficie/dimensioni, attrezzatura reale, come funziona il punteggio, le 2-4 regole che più " +
      "condizionano come si allena, e il gergo tecnico che un allenatore userebbe davvero.\n\n" +
      `Sport: ${sportName}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          formats: {
            type: "array",
            items: { type: "string", enum: ["INDIVIDUAL", "PAIR", "TEAM"] },
            description: "In quali formati si gioca/allena normalmente questo sport (può essere più di uno).",
          },
          environment: { type: "string", description: "Campo/superficie/spazio di gioco: tipo, dimensioni, elementi chiave." },
          equipment: { type: "string", description: "Attrezzatura reale usata in questo sport (non generica)." },
          scoringSystem: { type: "string", description: "Come funziona punteggio/vittoria in questo sport." },
          keyRules: { type: "string", description: "Le regole che più condizionano come si struttura un allenamento per questo sport." },
          terminology: { type: "string", description: "Termini tecnici specifici di questo sport che un allenatore userebbe, elencati brevemente." },
        },
        required: ["formats", "environment", "equipment", "scoringSystem", "keyRules", "terminology"],
      },
    },
  });

  try {
    const parsed = JSON.parse(response.text ?? "") as GeneratedSportProfile;
    return { ...parsed, formats: parsed.formats?.length ? parsed.formats : ["INDIVIDUAL"] };
  } catch (err) {
    console.error("Failed to parse sport profile from Gemini", err, response.text);
    return {
      formats: ["INDIVIDUAL"],
      environment: "",
      equipment: "",
      scoringSystem: "",
      keyRules: "",
      terminology: "",
    };
  }
}
