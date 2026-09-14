"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { trackClient } from "@/lib/track-client";

type ActionType =
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

type Confidence = "HIGH" | "MEDIUM" | "LOW";

type Recommendation = {
  id: string;
  actionType: ActionType;
  priorityLabel: string;
  facts: string[];
  pattern: string;
  recommendation: string;
  confidence: Confidence;
  missingData: string[];
  suggestedObjective: string | null;
  suggestedDurationMinutes: number | null;
  feedback: "USEFUL" | "NOT_USEFUL" | null;
  createdAt: string;
};

type Diagnosis = {
  hasEnoughData: boolean;
  evidence: string[];
  bottleneckHypothesis: string | null;
  recommendedExperiment: string | null;
};

const ACTION_TYPE_LABEL: Record<ActionType, string> = {
  TRAIN_SKILL: "Allenare una competenza",
  CHANGE_EXERCISE: "Cambiare esercizio",
  PROGRESS_EXERCISE: "Far progredire l'esercizio",
  REGRESS_EXERCISE: "Semplificare l'esercizio",
  CHANGE_SESSION_STRUCTURE: "Cambiare struttura sessione",
  CHANGE_INTENSITY: "Cambiare intensità",
  REASSESS: "Rivalutare",
  CREATE_OBJECTIVE: "Creare un obiettivo",
  PREPARE_COMPETITION: "Preparare la competizione",
  REVIEW_COMPETITION: "Rivedere la competizione",
  CHANGE_PRIORITY: "Cambiare priorità",
  MAINTAIN_CURRENT_FOCUS: "Mantenere il focus attuale",
};

const CONFIDENCE_LABEL: Record<Confidence, string> = { HIGH: "Alta confidenza", MEDIUM: "Confidenza media", LOW: "Confidenza bassa" };
const CONFIDENCE_STYLE: Record<Confidence, string> = {
  HIGH: "bg-positive/15 text-positive",
  MEDIUM: "bg-improving/15 text-improving",
  LOW: "bg-surface-2 text-muted",
};

/**
 * Master prompt §5-9: the Coaching Intelligence Engine surfaced as a single
 * "what should I do next" panel, shared by athlete and team pages. basePath
 * is the subject's own API root (/api/athletes/{id} or /api/teams/{id}) —
 * every sub-resource (next-action, diagnose, sessions) hangs off it.
 */
export function NextBestActionCard({ basePath, showDiagnose = false }: { basePath: string; showDiagnose?: boolean }) {
  const router = useRouter();
  const [recommendation, setRecommendation] = useState<Recommendation | null | undefined>(undefined);
  const [generating, setGenerating] = useState(false);
  const [buildingSession, setBuildingSession] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null);
  const [diagnosing, setDiagnosing] = useState(false);
  const [showReasonInput, setShowReasonInput] = useState(false);
  const [reasonText, setReasonText] = useState("");
  const [reasonSaved, setReasonSaved] = useState(false);

  useEffect(() => {
    fetch(`${basePath}/next-action`)
      .then((res) => (res.ok ? res.json() : { recommendation: null }))
      .then((data) => setRecommendation(data.recommendation ?? null));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- basePath is fixed for the component's lifetime
  }, [basePath]);

  async function generate() {
    setGenerating(true);
    setError(null);
    setDiagnosis(null);
    setShowReasonInput(false);
    setReasonSaved(false);
    setReasonText("");
    const res = await fetch(`${basePath}/next-action`, { method: "POST" });
    const data = await res.json();
    setGenerating(false);
    if (!res.ok) {
      setError(data.error ?? "Errore durante la generazione.");
      return;
    }
    setRecommendation(data.recommendation);
    trackClient("next_action_generated", {});
  }

  async function sendFeedback(feedback: "USEFUL" | "NOT_USEFUL") {
    if (!recommendation) return;
    const res = await fetch(`${basePath}/next-action/${recommendation.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feedback }),
    });
    if (res.ok) {
      setRecommendation((prev) => (prev ? { ...prev, feedback } : prev));
      trackClient("recommendation_feedback_recorded", { feedback });
      if (feedback === "NOT_USEFUL") setShowReasonInput(true);
    }
  }

  async function submitReason() {
    if (!recommendation || !reasonText.trim()) return;
    const res = await fetch(`${basePath}/next-action/${recommendation.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feedback: "NOT_USEFUL", feedbackReason: reasonText.trim() }),
    });
    if (res.ok) {
      setReasonSaved(true);
      setShowReasonInput(false);
    }
  }

  async function buildSession() {
    if (!recommendation) return;
    setBuildingSession(true);
    setError(null);
    const res = await fetch(`${basePath}/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        durationMinutes: recommendation.suggestedDurationMinutes ?? 60,
        objective: recommendation.suggestedObjective ?? undefined,
      }),
    });
    const data = await res.json();
    setBuildingSession(false);
    if (!res.ok) {
      setError(data.error ?? "Errore durante la generazione della sessione.");
      return;
    }
    router.push(`/sessions/${data.sessionId}`);
  }

  async function runDiagnosis() {
    setDiagnosing(true);
    setError(null);
    const res = await fetch(`${basePath}/diagnose`, { method: "POST" });
    const data = await res.json();
    setDiagnosing(false);
    if (!res.ok) {
      setError(data.error ?? "Errore durante la diagnosi.");
      return;
    }
    setDiagnosis(data.diagnosis);
    trackClient("bottleneck_diagnosed", {});
  }

  return (
    <div className="mb-6 rounded-xl border border-accent/30 bg-accent/5 p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-accent">Cosa dovrei fare adesso?</h2>
        <button
          onClick={generate}
          disabled={generating}
          className="rounded-md border border-border px-3 py-1.5 text-xs transition-colors hover:bg-surface disabled:opacity-50"
        >
          {generating ? "Analisi in corso…" : recommendation ? "Rigenera" : "Genera raccomandazione"}
        </button>
      </div>

      {error && <p className="mb-2 text-xs text-negative">{error}</p>}

      {recommendation === undefined ? (
        <p className="text-sm text-muted">Caricamento…</p>
      ) : !recommendation ? (
        <p className="text-sm text-muted">
          Non ancora generata. Più note, valutazioni e sessioni registri, più questa raccomandazione diventa affidabile.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs text-muted">{ACTION_TYPE_LABEL[recommendation.actionType]}</p>
              <h3 className="text-lg font-semibold">{recommendation.priorityLabel}</h3>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${CONFIDENCE_STYLE[recommendation.confidence]}`}>
              {CONFIDENCE_LABEL[recommendation.confidence]}
            </span>
          </div>

          {recommendation.facts.length > 0 && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted">Perché ora</p>
              <ul className="mt-1 space-y-1">
                {recommendation.facts.map((fact, i) => (
                  <li key={i} className="text-sm text-foreground/80">
                    • {fact}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {recommendation.pattern && (
            <p className="rounded-md bg-surface-2 p-3 text-sm text-muted">
              <span className="font-medium text-foreground/70">Pattern: </span>
              {recommendation.pattern}
            </p>
          )}

          <p className="text-sm text-foreground/90">{recommendation.recommendation}</p>

          {recommendation.missingData.length > 0 && (
            <div className="rounded-md border border-dashed border-border p-3">
              <p className="text-xs font-medium text-muted">Dati che renderebbero questa raccomandazione più solida:</p>
              <ul className="mt-1 space-y-0.5">
                {recommendation.missingData.map((m, i) => (
                  <li key={i} className="text-xs text-muted">
                    • {m}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            {recommendation.suggestedObjective && (
              <button
                onClick={buildSession}
                disabled={buildingSession}
                className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {buildingSession ? "Generazione…" : "Costruisci sessione"}
              </button>
            )}
            {showDiagnose && (
              <button onClick={runDiagnosis} disabled={diagnosing} className="rounded-md border border-border px-3 py-2 text-sm hover:bg-surface disabled:opacity-50">
                {diagnosing ? "Analisi…" : "Perché non migliora?"}
              </button>
            )}
            <div className="ml-auto flex items-center gap-1 text-xs text-muted">
              <span>Utile?</span>
              <button
                onClick={() => sendFeedback("USEFUL")}
                className={`rounded-md px-2 py-1 ${recommendation.feedback === "USEFUL" ? "bg-positive/15 text-positive" : "hover:bg-surface-2"}`}
              >
                👍
              </button>
              <button
                onClick={() => sendFeedback("NOT_USEFUL")}
                className={`rounded-md px-2 py-1 ${recommendation.feedback === "NOT_USEFUL" ? "bg-negative/15 text-negative" : "hover:bg-surface-2"}`}
              >
                👎
              </button>
            </div>
          </div>

          {showReasonInput && (
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed border-border p-2.5">
              <input
                value={reasonText}
                onChange={(e) => setReasonText(e.target.value)}
                placeholder="Perché non è utile? (opzionale, aiuta l&apos;AI a imparare)"
                maxLength={300}
                className="min-w-[220px] flex-1 rounded-md border border-border bg-surface-2 px-2.5 py-1.5 text-xs outline-none focus:border-accent"
              />
              <button
                onClick={submitReason}
                disabled={!reasonText.trim()}
                className="rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-surface disabled:opacity-40"
              >
                Salva
              </button>
              <button onClick={() => setShowReasonInput(false)} className="text-xs text-muted hover:underline">
                Salta
              </button>
            </div>
          )}
          {reasonSaved && <p className="text-xs text-muted">Motivo salvato, grazie — aiuterà le prossime raccomandazioni.</p>}
        </div>
      )}

      {diagnosis && (
        <div className="mt-4 rounded-md border border-dashed border-border p-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted">Perché non migliora?</p>
          {!diagnosis.hasEnoughData ? (
            <p className="mt-1.5 text-sm text-muted">Non ci sono ancora abbastanza dati per un&apos;ipotesi affidabile.</p>
          ) : (
            <>
              {diagnosis.evidence.length > 0 && (
                <ul className="mt-1.5 space-y-1">
                  {diagnosis.evidence.map((e, i) => (
                    <li key={i} className="text-sm text-foreground/80">
                      • {e}
                    </li>
                  ))}
                </ul>
              )}
              {diagnosis.bottleneckHypothesis && <p className="mt-2 text-sm text-foreground/90">{diagnosis.bottleneckHypothesis}</p>}
              {diagnosis.recommendedExperiment && (
                <p className="mt-2 rounded-md bg-surface-2 p-2 text-xs text-muted">
                  <span className="font-medium text-foreground/70">Vale la pena provare: </span>
                  {diagnosis.recommendedExperiment}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
