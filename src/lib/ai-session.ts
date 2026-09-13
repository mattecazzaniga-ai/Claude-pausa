import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;
const MODEL = "gemini-2.5-flash";

export type LibraryExercise = {
  id: string;
  name: string;
  category: string;
  format: string | null;
  difficulty: string | null;
  durationMinutes: number | null;
  equipment: string | null;
  skillNames: string[];
};

export type GeneratedBlock = {
  type: "WARMUP" | "TECHNICAL" | "TACTICAL" | "PHYSICAL" | "GAME" | "COOLDOWN";
  durationMinutes: number;
  rationale: string;
  /** Empty string means "no match in the library — see newExercise*" (see note below on why not `null`). */
  chosenExerciseId: string;
  newExerciseName: string;
  newExerciseDescription: string;
  newExerciseCoachingPoints: string;
};

export type GeneratedSessionPlan = {
  objective: string;
  blocks: GeneratedBlock[];
};

/**
 * Generates a structured multi-block training session. Knowledge priority
 * (per product spec): the coach's OWN exercise library is passed in and the
 * model is instructed to pick from it whenever a block's objective is
 * covered — a brand-new exercise is only proposed when nothing fits. The
 * response marks each block accordingly (chosenExerciseId set vs the
 * newExercise* fields set) so the caller never has to guess.
 */
export async function generateSessionPlan(params: {
  athleteName: string;
  objectives: string | null;
  aiSummary: string | null;
  aiPriorities: { skill: string; reason: string }[];
  durationMinutes: number;
  sessionObjective?: string;
  equipmentAvailable?: string;
  intensity?: string;
  libraryExercises: LibraryExercise[];
}): Promise<GeneratedSessionPlan> {
  if (!ai) throw new Error("AI not configured: GEMINI_API_KEY is missing.");

  const libraryText = params.libraryExercises.length
    ? params.libraryExercises
        .map(
          (e) =>
            `- ${e.id}: "${e.name}" [${e.category}${e.format ? `/${e.format}` : ""}${e.difficulty ? `/${e.difficulty}` : ""}]` +
            `${e.durationMinutes ? `, ~${e.durationMinutes} min` : ""}${e.equipment ? `, attrezzatura: ${e.equipment}` : ""}` +
            `${e.skillNames.length ? `, competenze: ${e.skillNames.join(", ")}` : ""}`
        )
        .join("\n")
    : "(la libreria dell'allenatore è vuota)";

  const prioritiesText = params.aiPriorities.length
    ? params.aiPriorities.map((p) => `- ${p.skill}: ${p.reason}`).join("\n")
    : "Nessuna priorità specifica registrata ancora.";

  const response = await ai.models.generateContent({
    model: MODEL,
    contents:
      "Sei un assistente per allenatori sportivi che costruisce sessioni di allenamento personalizzate. " +
      "REGOLA FONDAMENTALE: prima cerca nella libreria di esercizi dell'allenatore fornita sotto. Usa un esercizio esistente (chosenExerciseId) " +
      "ogni volta che copre ragionevolmente l'obiettivo del blocco. Proponi un esercizio nuovo (newExercise*) SOLO se nella libreria non c'è " +
      "nulla di adatto per quel blocco. Non inventare quando esiste già qualcosa di utilizzabile.\n\n" +
      `Atleta: ${params.athleteName}\n` +
      `Obiettivi generali: ${params.objectives || "Non specificati"}\n` +
      `Sintesi recente: ${params.aiSummary || "Nessuna ancora"}\n` +
      `Priorità attuali:\n${prioritiesText}\n\n` +
      `Durata sessione richiesta: ${params.durationMinutes} minuti\n` +
      `${params.sessionObjective ? `Obiettivo specifico per questa sessione: ${params.sessionObjective}\n` : ""}` +
      `${params.equipmentAvailable ? `Attrezzatura disponibile: ${params.equipmentAvailable}\n` : ""}` +
      `${params.intensity ? `Intensità desiderata: ${params.intensity}\n` : ""}\n` +
      `Libreria esercizi dell'allenatore per questo sport:\n${libraryText}\n\n` +
      "Struttura la sessione in blocchi (tipicamente riscaldamento, uno o più blocchi tecnici/tattici/fisici legati alle priorità, situazione di gioco, defaticamento). " +
      "La somma delle durate dei blocchi deve essere vicina alla durata totale richiesta.",
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          objective: { type: "string", description: "Obiettivo generale della sessione, 1 frase." },
          blocks: {
            type: "array",
            items: {
              type: "object",
              properties: {
                type: { type: "string", enum: ["WARMUP", "TECHNICAL", "TACTICAL", "PHYSICAL", "GAME", "COOLDOWN"] },
                durationMinutes: { type: "integer" },
                rationale: {
                  type: "string",
                  description: "Perché questo blocco/esercizio è stato scelto per QUESTO atleta ora, collegato a priorità/storico se possibile.",
                },
                chosenExerciseId: {
                  type: "string",
                  description: "ID esatto dalla libreria fornita, oppure stringa vuota se si propone un esercizio nuovo.",
                },
                newExerciseName: { type: "string", description: "Vuoto se è stato scelto un esercizio esistente." },
                newExerciseDescription: { type: "string", description: "Vuoto se è stato scelto un esercizio esistente." },
                newExerciseCoachingPoints: { type: "string", description: "Vuoto se è stato scelto un esercizio esistente." },
              },
              required: ["type", "durationMinutes", "rationale", "chosenExerciseId", "newExerciseName", "newExerciseDescription", "newExerciseCoachingPoints"],
            },
          },
        },
        required: ["objective", "blocks"],
      },
    },
  });

  const parsed = JSON.parse(response.text ?? "{}") as GeneratedSessionPlan;
  const validIds = new Set(params.libraryExercises.map((e) => e.id));
  return {
    objective: parsed.objective ?? "",
    blocks: (parsed.blocks ?? []).map((b) => ({ ...b, chosenExerciseId: validIds.has(b.chosenExerciseId) ? b.chosenExerciseId : "" })),
  };
}

/**
 * Finds/generates one replacement for a single block — same shape as a
 * single block from generateSessionPlan, reused for "one-click replace".
 */
export async function generateReplacementExercise(params: {
  blockType: string;
  currentExerciseName: string;
  libraryExercises: LibraryExercise[];
  excludeExerciseId: string;
}): Promise<GeneratedBlock> {
  if (!ai) throw new Error("AI not configured: GEMINI_API_KEY is missing.");

  const candidates = params.libraryExercises.filter((e) => e.id !== params.excludeExerciseId);
  const libraryText = candidates.length
    ? candidates
        .map((e) => `- ${e.id}: "${e.name}" [${e.category}${e.difficulty ? `/${e.difficulty}` : ""}]${e.skillNames.length ? `, competenze: ${e.skillNames.join(", ")}` : ""}`)
        .join("\n")
    : "(nessun altro esercizio disponibile nella libreria)";

  const response = await ai.models.generateContent({
    model: MODEL,
    contents:
      `Un allenatore vuole sostituire l'esercizio "${params.currentExerciseName}" (blocco di tipo ${params.blockType}) con un'alternativa che copra lo stesso obiettivo. ` +
      "Cerca prima nella libreria fornita; proponi un esercizio nuovo solo se non c'è nulla di adatto.\n\n" +
      `Libreria disponibile:\n${libraryText}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          chosenExerciseId: { type: "string" },
          newExerciseName: { type: "string" },
          newExerciseDescription: { type: "string" },
          newExerciseCoachingPoints: { type: "string" },
          rationale: { type: "string" },
        },
        required: ["chosenExerciseId", "newExerciseName", "newExerciseDescription", "newExerciseCoachingPoints", "rationale"],
      },
    },
  });

  const validIds = new Set(candidates.map((e) => e.id));
  const parsed = JSON.parse(response.text ?? "{}") as Omit<GeneratedBlock, "type" | "durationMinutes">;
  return {
    type: params.blockType as GeneratedBlock["type"],
    durationMinutes: 0,
    ...parsed,
    chosenExerciseId: validIds.has(parsed.chosenExerciseId) ? parsed.chosenExerciseId : "",
  };
}
