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
  positions: string;
  movementPatterns: string;
  gameSituations: string;
  trainingMethods: string;
  commonProblems: string;
  progressions: string;
  safetyNotes: string;
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
      "Sii concreto e specifico su OGNI campo richiesto: campo/superficie/dimensioni, attrezzatura reale, come funziona il punteggio, le 2-4 regole che più " +
      "condizionano come si allena, il gergo tecnico che un allenatore userebbe davvero, i ruoli/posizioni tipici (se lo sport ne ha — lascia vuoto se è " +
      "uno sport senza ruoli fissi), i pattern di movimento realmente specifici di questo sport (non 'correre e saltare' generico), le situazioni di gioco " +
      "reali che si allenano, i metodi/metodologie di allenamento usati davvero in questo sport, i problemi tecnici/tattici più comuni negli atleti di " +
      "livello medio, come si strutturano le progressioni didattiche, e gli aspetti di sicurezza/infortuni tipici da tenere a mente.\n\n" +
      "ATTENZIONE — ERRORE DA EVITARE ASSOLUTAMENTE: la contaminazione terminologica tra sport simili. " +
      "Prima di rispondere, identifica mentalmente gli sport con cui questo sport viene più spesso confuso " +
      "(es. Beach Tennis è spesso confuso con Padel e Tennis; Calcio a 5 con Calcio; Beach Volley con Pallavolo; Squash con Racchetball). " +
      "Ognuno di questi sport ha attrezzatura, regole e gergo PROPRI e DIVERSI, anche se sembrano simili a prima vista " +
      "(es. il Padel si gioca con racchetta forata senza corde dentro un campo chiuso da pareti e usa colpi come 'chiquita' o 'bandeja'; " +
      "il Beach Tennis si gioca con racchetta rigida piena, senza palleggio a terra, in un campo di sabbia senza pareti: questi due sport " +
      "NON condividono gergo tecnico). Includi SOLO terminologia, colpi, regole, attrezzatura, pattern di movimento e metodologie che sai con certezza " +
      "appartenere a QUESTO sport esatto — la stessa cautela vale per ogni campo, non solo per la terminologia. Se hai anche un minimo dubbio che un " +
      "elemento appartenga invece a uno sport simile, NON includerlo.\n\n" +
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
          positions: {
            type: "string",
            description: "Ruoli/posizioni tipici di questo sport, se esistono. Stringa vuota se lo sport non ha ruoli fissi.",
          },
          movementPatterns: { type: "string", description: "Pattern di movimento realmente specifici e ricorrenti in questo sport." },
          gameSituations: { type: "string", description: "Situazioni di gioco/allenamento reali tipiche di questo sport." },
          trainingMethods: { type: "string", description: "Metodologie/approcci di allenamento realmente usati in questo sport." },
          commonProblems: { type: "string", description: "Problemi tecnici/tattici più comuni negli atleti di livello medio in questo sport." },
          progressions: { type: "string", description: "Come si strutturano tipicamente le progressioni didattiche in questo sport." },
          safetyNotes: { type: "string", description: "Aspetti di sicurezza/infortuni tipici a cui prestare attenzione in questo sport." },
        },
        required: [
          "formats",
          "environment",
          "equipment",
          "scoringSystem",
          "keyRules",
          "terminology",
          "positions",
          "movementPatterns",
          "gameSituations",
          "trainingMethods",
          "commonProblems",
          "progressions",
          "safetyNotes",
        ],
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
      positions: "",
      movementPatterns: "",
      gameSituations: "",
      trainingMethods: "",
      commonProblems: "",
      progressions: "",
      safetyNotes: "",
    };
  }
}
