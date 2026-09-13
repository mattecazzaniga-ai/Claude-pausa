import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;

/** The rest of the app can check this to show a clear "AI not configured" state instead of failing silently. */
export const isAiConfigured = Boolean(apiKey);

const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

// Free-tier model (Google AI Studio / Gemini Developer API — no credit card
// required). Same model for extraction and summary: both calls are small
// and cheap enough that splitting cheap/strong models isn't worth the
// complexity while this runs on the free tier.
const MODEL = "gemini-2.5-flash";

export type SkillOption = { id: string; name: string; category: string };

export type ExtractedTag = {
  skillId: string;
  sentiment: "POSITIVE" | "NEGATIVE" | "NEUTRAL" | "IMPROVING";
  excerpt: string;
};

function requireAi() {
  if (!ai) throw new Error("AI not configured: GEMINI_API_KEY is missing.");
  return ai;
}

function parseJson<T>(text: string | undefined, fallback: T): T {
  if (!text) return fallback;
  try {
    return JSON.parse(text) as T;
  } catch (err) {
    console.error("Failed to parse Gemini JSON response", err, text);
    return fallback;
  }
}

/**
 * Turns one free-text coaching note into structured tags against the sport's
 * skill taxonomy, using Gemini's structured-output mode (a JSON schema the
 * response is constrained to) rather than a naive "parse this JSON" prompt.
 */
export async function extractTagsFromNote(noteText: string, skills: SkillOption[]): Promise<ExtractedTag[]> {
  const client = requireAi();
  if (skills.length === 0) return [];

  const skillList = skills.map((s) => `- ${s.id}: ${s.category} / ${s.name}`).join("\n");

  const response = await client.models.generateContent({
    model: MODEL,
    contents:
      "Sei un assistente che estrae osservazioni tecniche strutturate dalle note di un allenatore sportivo. " +
      "Identifica solo le competenze esplicitamente osservate nel testo, con la frase esatta (o quasi) da cui deriva l'osservazione. " +
      "Non inventare competenze non menzionate. Se il testo non menziona nulla di specifico, restituisci una lista vuota.\n\n" +
      `Nota dell'allenatore:\n"""${noteText}"""\n\n` +
      `Competenze disponibili per questo sport (usa esattamente questi ID):\n${skillList}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          observations: {
            type: "array",
            items: {
              type: "object",
              properties: {
                skillId: { type: "string", description: "L'ID esatto della competenza dalla lista fornita." },
                sentiment: {
                  type: "string",
                  enum: ["POSITIVE", "NEGATIVE", "NEUTRAL", "IMPROVING"],
                  description:
                    "POSITIVE = punto di forza confermato, NEGATIVE = criticità/problema, IMPROVING = in miglioramento ma non ancora risolto, NEUTRAL = osservazione senza giudizio.",
                },
                excerpt: { type: "string", description: "La frase o porzione di testo da cui deriva l'osservazione." },
              },
              required: ["skillId", "sentiment", "excerpt"],
            },
          },
        },
        required: ["observations"],
      },
    },
  });

  const parsed = parseJson<{ observations?: ExtractedTag[] }>(response.text, {});
  const validIds = new Set(skills.map((s) => s.id));

  return (parsed.observations ?? []).filter((obs) => validIds.has(obs.skillId));
}

export type AthletePriority = { skill: string; reason: string };
export type AthleteAiSummary = { summary: string; priorities: AthletePriority[] };

type TaggedNote = {
  sessionDate: Date;
  rawText: string;
  tags: { sentiment: string; skillName: string; categoryName: string }[];
};

/**
 * Synthesizes recent session history into a short narrative + a ranked list
 * of current priorities. Only receives the last N notes for THIS athlete —
 * not the coach's whole roster — which keeps the context small and relevant
 * without needing retrieval/vector search at this scale.
 */
export async function generateAthleteSummary(params: {
  athleteName: string;
  objectives: string | null;
  notes: TaggedNote[];
}): Promise<AthleteAiSummary> {
  const client = requireAi();

  const notesText = params.notes
    .map((n) => {
      const tagsText = n.tags.map((t) => `    - [${t.sentiment}] ${t.categoryName}/${t.skillName}`).join("\n");
      return `Sessione del ${n.sessionDate.toLocaleDateString("it-IT")}:\n  Nota: "${n.rawText}"\n${tagsText ? `  Tag rilevati:\n${tagsText}` : ""}`;
    })
    .join("\n\n");

  const response = await client.models.generateContent({
    model: MODEL,
    contents:
      "Sei un assistente per allenatori sportivi. Analizzi lo storico delle sessioni di un atleta e produci una sintesi utile e concreta, " +
      "in italiano, con un tono da collega esperto, non da report burocratico. Individua pattern ricorrenti (non singoli episodi isolati) " +
      "e dai priorità concrete e azionabili per la prossima sessione. Sii specifico, evita generalità.\n\n" +
      `Atleta: ${params.athleteName}\n` +
      `Obiettivi: ${params.objectives || "Non specificati"}\n\n` +
      `Storico sessioni (dalla più vecchia alla più recente):\n\n${notesText}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          summary: {
            type: "string",
            description:
              "2-4 frasi: cosa emerge dallo storico, cosa è consolidato, cosa è ricorrente/problematico. Colloquiale ma preciso.",
          },
          priorities: {
            type: "array",
            items: {
              type: "object",
              properties: {
                skill: { type: "string", description: "Nome della competenza su cui concentrarsi." },
                reason: { type: "string", description: "Perché è la priorità, basato sui pattern osservati." },
              },
              required: ["skill", "reason"],
            },
          },
        },
        required: ["summary", "priorities"],
      },
    },
  });

  return parseJson<AthleteAiSummary>(response.text, {
    summary: "Non è stato possibile generare una sintesi.",
    priorities: [],
  });
}
