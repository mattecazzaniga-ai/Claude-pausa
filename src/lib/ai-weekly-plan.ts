import { GoogleGenAI } from "@google/genai";
import { formatContextForPrompt, type IntelligenceContext } from "@/lib/intelligence/context";

const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;
const MODEL = "gemini-3.6-flash";

export type PlanIntensity = "ALTA" | "MEDIA" | "BASSA";
export type PlanPhase = "CARICO" | "SCARICO" | "MANTENIMENTO";

export type GeneratedPlanSlot = { order: number; intensity: PlanIntensity; discipline: string; focus: string };
export type GeneratedWeeklyPlan = { phase: PlanPhase; rationale: string; slots: GeneratedPlanSlot[] };

/**
 * Weekly Training Plan (feedback: "posso impostare quante volte a settimana
 * mi alleno" + "l'AI deve essere più precisa su carico/scarico" + sport
 * multi-disciplina come il triathlon). Reuses the exact same
 * IntelligenceContext every other decision (Next Best Action, bottleneck
 * diagnosis, performance level, gap engine) already reasons over — no
 * separate signal-gathering built just for this. Produces only the WEEK'S
 * SKELETON (phase + one slot per session): the actual exercise content for
 * each slot is generated afterwards by reusing generateSessionPlan /
 * generateTeamSessionPlan (see lib/weekly-plan.ts#fillPlanSlot), never a
 * second session-generation engine.
 *
 * Never invents a training phase: CARICO is the only safe default when
 * there isn't enough real history to justify SCARICO/MANTENIMENTO, and the
 * prompt says so explicitly — mirrors diagnoseBottleneck/
 * assessPerformanceLevel's own "don't guess" discipline.
 */
export async function generateWeeklyPlanSkeleton(params: {
  context: IntelligenceContext;
  sessionsPerWeek: number;
  disciplines: string[];
  methodologyText?: string;
}): Promise<GeneratedWeeklyPlan> {
  if (!ai) throw new Error("AI not configured: GEMINI_API_KEY is missing.");

  const contextText = formatContextForPrompt(params.context);

  const disciplinesInstruction = params.disciplines.length
    ? `Questo sport allena più discipline separate: ${params.disciplines.join(", ")}. Distribuisci le sessioni tra le discipline in modo ` +
      "equilibrato nell'arco della settimana (campo discipline di ogni sessione) — a meno che check-in, infortuni o obiettivi indichino di " +
      "concentrarsi su una in particolare, motivandolo nel focus della sessione.\n\n"
    : "";

  const response = await ai.models.generateContent({
    model: MODEL,
    contents:
      "Sei un allenatore esperto che pianifica UNA SETTIMANA di allenamento (microciclo), non una singola sessione. " +
      "Decidi la FASE della settimana basandoti SOLO sui dati reali forniti sotto (allenamenti/check-in recenti, competizione imminente, " +
      "metodologia dichiarata dal coach):\n" +
      "- CARICO: si può mantenere o aumentare il carico di lavoro.\n" +
      "- SCARICO: settimana di recupero attivo, volume/intensità ridotti — solo se i dati mostrano segnali reali di affaticamento accumulato " +
      "(check-in negativi ripetuti, molte sessioni intense recenti) o una competizione imminente che richiede tapering.\n" +
      "- MANTENIMENTO: si mantiene il livello attuale senza spingere né scaricare.\n" +
      "Se non c'è storico sufficiente per dedurre affaticamento o necessità di scarico, la scelta di default è CARICO (si sta costruendo la base) " +
      "— non inventare mai un affaticamento o una fase avanzata di un ciclo che i dati forniti non mostrano davvero.\n\n" +
      `Distribuisci ESATTAMENTE ${params.sessionsPerWeek} sessioni nella settimana, assegnando a ciascuna un'intensità (ALTA/MEDIA/BASSA) ` +
      "coerente con la fase scelta e con una progressione sensata (es. non mettere due sessioni ALTA consecutive senza una più leggera in mezzo, " +
      "a meno che la fase e lo sport non lo richiedano esplicitamente). Per ogni sessione scrivi un obiettivo/focus breve e concreto.\n\n" +
      disciplinesInstruction +
      `${params.methodologyText ? `${params.methodologyText}\n\n` : ""}` +
      contextText +
      `\n\nSessioni richieste questa settimana: ${params.sessionsPerWeek}\n` +
      "Scrivi in italiano.",
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          phase: { type: "string", enum: ["CARICO", "SCARICO", "MANTENIMENTO"] },
          rationale: { type: "string", description: "Perché questa fase, citando i fatti reali usati (mai un'ipotesi non supportata dai dati)." },
          slots: {
            type: "array",
            items: {
              type: "object",
              properties: {
                order: { type: "integer" },
                intensity: { type: "string", enum: ["ALTA", "MEDIA", "BASSA"] },
                discipline: { type: "string", description: "Vuoto se lo sport non ha discipline separate." },
                focus: { type: "string", description: "Obiettivo breve e concreto di questa sessione." },
              },
              required: ["order", "intensity", "discipline", "focus"],
            },
          },
        },
        required: ["phase", "rationale", "slots"],
      },
    },
  });

  try {
    const parsed = JSON.parse(response.text ?? "{}") as GeneratedWeeklyPlan;
    return {
      phase: parsed.phase ?? "CARICO",
      rationale: parsed.rationale ?? "",
      slots: (parsed.slots ?? []).map((s, i) => ({ ...s, order: i + 1, discipline: s.discipline || "" })),
    };
  } catch (err) {
    console.error("Failed to parse weekly plan from Gemini", err, response.text);
    return { phase: "CARICO", rationale: "", slots: [] };
  }
}
