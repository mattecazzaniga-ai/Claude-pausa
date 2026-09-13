import { GoogleGenAI } from "@google/genai";
import type { SkillOption } from "@/lib/ai";

const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;
const MODEL = "gemini-3.6-flash";

export type ParsedExercise = {
  name: string;
  description: string;
  category: "TECHNICAL" | "TACTICAL" | "PHYSICAL" | "COGNITIVE" | "WARMUP" | "COOLDOWN" | "COMPETITIVE";
  format: "INDIVIDUAL" | "PAIR" | "SMALL_GROUP" | "TEAM" | "GAME" | null;
  difficulty: "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "ELITE" | null;
  durationMinutes: number | null;
  minAthletes: number | null;
  maxAthletes: number | null;
  equipment: string | null;
  coachingPoints: string | null;
  tags: string[];
  skillIds: string[];
};

/**
 * Turns a one-line description ("2v2 dove la coppia segna solo dopo un lob")
 * into a structured exercise draft. The coach reviews/edits everything
 * before saving — this never writes to the DB itself.
 */
export async function parseExerciseFromText(description: string, skills: SkillOption[]): Promise<ParsedExercise> {
  if (!ai) throw new Error("AI not configured: GEMINI_API_KEY is missing.");

  const skillList = skills.map((s) => `- ${s.id}: ${s.category} / ${s.name}`).join("\n");

  const response = await ai.models.generateContent({
    model: MODEL,
    contents:
      "Sei un assistente per allenatori sportivi. Trasforma la descrizione di un esercizio, scritta velocemente da un allenatore, " +
      "in una scheda esercizio strutturata e completa. Deduci i campi mancanti in modo ragionevole dal contesto sportivo. " +
      "Scrivi in italiano.\n\n" +
      `Descrizione dell'allenatore:\n"""${description}"""\n\n` +
      `Competenze disponibili per questo sport (collega quelle pertinenti, usa esattamente questi ID):\n${skillList}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Nome breve ed efficace dell'esercizio." },
          description: { type: "string", description: "Descrizione chiara di come si svolge l'esercizio." },
          category: { type: "string", enum: ["TECHNICAL", "TACTICAL", "PHYSICAL", "COGNITIVE", "WARMUP", "COOLDOWN", "COMPETITIVE"] },
          format: { type: "string", enum: ["INDIVIDUAL", "PAIR", "SMALL_GROUP", "TEAM", "GAME"] },
          difficulty: { type: "string", enum: ["BEGINNER", "INTERMEDIATE", "ADVANCED", "ELITE"] },
          durationMinutes: { type: "integer" },
          minAthletes: { type: "integer" },
          maxAthletes: { type: "integer" },
          equipment: { type: "string", description: "Attrezzatura necessaria, o stringa vuota se nessuna." },
          coachingPoints: { type: "string", description: "1-3 punti chiave a cui l'allenatore deve prestare attenzione." },
          tags: { type: "array", items: { type: "string" } },
          skillIds: { type: "array", items: { type: "string" }, description: "ID delle competenze pertinenti dalla lista fornita." },
        },
        required: ["name", "description", "category", "tags", "skillIds"],
      },
    },
  });

  const validIds = new Set(skills.map((s) => s.id));
  const parsed = JSON.parse(response.text ?? "{}") as ParsedExercise;
  return { ...parsed, skillIds: (parsed.skillIds ?? []).filter((id) => validIds.has(id)) };
}
