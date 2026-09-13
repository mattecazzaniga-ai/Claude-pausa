import Anthropic from "@anthropic-ai/sdk";

const apiKey = process.env.ANTHROPIC_API_KEY;

/** The rest of the app can check this to show a clear "AI not configured" state instead of failing silently. */
export const isAiConfigured = Boolean(apiKey);

const anthropic = apiKey ? new Anthropic({ apiKey }) : null;

// Cheap/fast model for structured tagging, stronger model for the narrative
// synthesis a coach actually reads.
const EXTRACTION_MODEL = "claude-haiku-4-5-20251001";
const SUMMARY_MODEL = "claude-sonnet-5";

export type SkillOption = { id: string; name: string; category: string };

export type ExtractedTag = {
  skillId: string;
  sentiment: "POSITIVE" | "NEGATIVE" | "NEUTRAL" | "IMPROVING";
  excerpt: string;
};

/**
 * Turns one free-text coaching note into structured tags against the sport's
 * skill taxonomy, using tool-use (function calling) rather than a naive
 * "parse this JSON" prompt — the model is constrained to a schema, so the
 * output is always structurally valid.
 */
export async function extractTagsFromNote(noteText: string, skills: SkillOption[]): Promise<ExtractedTag[]> {
  if (!anthropic) throw new Error("AI not configured: ANTHROPIC_API_KEY is missing.");
  if (skills.length === 0) return [];

  const skillList = skills.map((s) => `- ${s.id}: ${s.category} / ${s.name}`).join("\n");

  const response = await anthropic.messages.create({
    model: EXTRACTION_MODEL,
    max_tokens: 1024,
    system:
      "Sei un assistente che estrae osservazioni tecniche strutturate dalle note di un allenatore sportivo. " +
      "Identifica solo le competenze esplicitamente osservate nel testo, con la frase esatta (o quasi) da cui deriva l'osservazione. " +
      "Non inventare competenze non menzionate. Se il testo non menziona nulla di specifico, restituisci una lista vuota.",
    messages: [
      {
        role: "user",
        content:
          `Nota dell'allenatore:\n"""${noteText}"""\n\n` +
          `Competenze disponibili per questo sport (usa esattamente questi ID):\n${skillList}`,
      },
    ],
    tools: [
      {
        name: "record_observations",
        description: "Registra le osservazioni tecniche strutturate estratte dalla nota.",
        input_schema: {
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
    ],
    tool_choice: { type: "tool", name: "record_observations" },
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") return [];

  const input = toolUse.input as { observations?: ExtractedTag[] };
  const validIds = new Set(skills.map((s) => s.id));

  return (input.observations ?? []).filter((obs) => validIds.has(obs.skillId));
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
  if (!anthropic) throw new Error("AI not configured: ANTHROPIC_API_KEY is missing.");

  const notesText = params.notes
    .map((n) => {
      const tagsText = n.tags.map((t) => `    - [${t.sentiment}] ${t.categoryName}/${t.skillName}`).join("\n");
      return `Sessione del ${n.sessionDate.toLocaleDateString("it-IT")}:\n  Nota: "${n.rawText}"\n${tagsText ? `  Tag rilevati:\n${tagsText}` : ""}`;
    })
    .join("\n\n");

  const response = await anthropic.messages.create({
    model: SUMMARY_MODEL,
    max_tokens: 1024,
    system:
      "Sei un assistente per allenatori sportivi. Analizzi lo storico delle sessioni di un atleta e produci una sintesi utile e concreta, " +
      "in italiano, con un tono da collega esperto, non da report burocratico. Individua pattern ricorrenti (non singoli episodi isolati) " +
      "e dai priorità concrete e azionabili per la prossima sessione. Sii specifico, evita generalità.",
    messages: [
      {
        role: "user",
        content:
          `Atleta: ${params.athleteName}\n` +
          `Obiettivi: ${params.objectives || "Non specificati"}\n\n` +
          `Storico sessioni (dalla più vecchia alla più recente):\n\n${notesText}`,
      },
    ],
    tools: [
      {
        name: "record_summary",
        description: "Registra la sintesi strutturata dello sviluppo dell'atleta.",
        input_schema: {
          type: "object",
          properties: {
            summary: {
              type: "string",
              description:
                "2-4 frasi: cosa emerge dallo storico, cosa è consolidato, cosa è ricorrente/problematico. Colloquiale ma preciso.",
            },
            priorities: {
              type: "array",
              maxItems: 3,
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
    ],
    tool_choice: { type: "tool", name: "record_summary" },
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    return { summary: "Non è stato possibile generare una sintesi.", priorities: [] };
  }

  return toolUse.input as AthleteAiSummary;
}
