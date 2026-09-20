"use client";

import { useState } from "react";
import { trackClient } from "@/lib/track-client";
import { MethodologyClient } from "./methodology-client";

type ReviewState = "ACTIVE" | "CONFIRMED" | "REJECTED";

type Preference = {
  id: string;
  insight: string;
  categoryLabel: string;
  evidenceCount: number;
  reviewState: ReviewState;
  updatedAt: string;
};

type MethodologyCategory =
  | "FILOSOFIA"
  | "VOLUME"
  | "INTENSITA"
  | "RECUPERO"
  | "PROGRESSIONE"
  | "REGRESSIONE"
  | "PERIODIZZAZIONE"
  | "SCELTA_ESERCIZI"
  | "ESERCIZI_PREFERITI"
  | "ESERCIZI_DA_EVITARE"
  | "PRE_COMPETIZIONE"
  | "POST_COMPETIZIONE"
  | "LIVELLI_ETA"
  | "REGOLE_SPORT_SPECIFICHE"
  | "ALTRO";

type MethodologyPrinciple = { id: string; text: string; category: MethodologyCategory };
type MethodologyVersionHistoryItem = { id: string; version: number; changeSummary: string; createdAt: string; principleCount: number };

export function CoachBrainClient({
  initialPrinciples,
  initialHistory,
  initialPreferences,
}: {
  initialPrinciples: MethodologyPrinciple[];
  initialHistory: MethodologyVersionHistoryItem[];
  initialPreferences: Preference[];
}) {
  const [preferences, setPreferences] = useState(initialPreferences);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showRejected, setShowRejected] = useState(false);

  const active = preferences.filter((p) => p.reviewState === "ACTIVE");
  const confirmed = preferences.filter((p) => p.reviewState === "CONFIRMED");
  const rejected = preferences.filter((p) => p.reviewState === "REJECTED");

  async function act(id: string, action: "confirm" | "reject" | "reactivate") {
    setBusyId(id);
    const res = await fetch(`/api/coach/coach-brain/${id}/${action}`, { method: "POST" });
    setBusyId(null);
    if (!res.ok) return;

    const nextState: ReviewState = action === "confirm" ? "CONFIRMED" : action === "reject" ? "REJECTED" : "ACTIVE";
    setPreferences((prev) => prev.map((p) => (p.id === id ? { ...p, reviewState: nextState } : p)));
    trackClient(action === "confirm" ? "coach_preference_confirmed" : action === "reject" ? "coach_preference_rejected" : "coach_preference_reactivated", {
      preferenceId: id,
    });
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pb-16 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Coach Brain</h1>
        <p className="mt-1 text-sm text-muted">
          Come MENTATHLOS capisce il tuo modo di allenare: i principi che scrivi tu, e i pattern che osserva da solo — solo da segnali
          reali, mai inventati. Conferma quello che ti riconosci, rifiuta quello che non ti rappresenta: nessuna delle due scelte è
          definitiva.
        </p>
      </div>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">Come alleno</h2>
      <MethodologyClient initialPrinciples={initialPrinciples} initialHistory={initialHistory} />

      <div className="mb-6 rounded-xl border border-border bg-surface p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">Cosa ho imparato di recente</h2>

        {active.length === 0 && confirmed.length === 0 ? (
          <p className="text-sm text-muted">
            Non c&apos;è ancora abbastanza segnale per riconoscere un pattern nel tuo modo di allenare. Continua a usare le
            raccomandazioni AI (accettandole, rifiutandole, sostituendo esercizi) — MENTATHLOS imparerà da lì, senza inventare nulla nel
            frattempo.
          </p>
        ) : (
          <div className="space-y-2">
            {[...confirmed, ...active].map((p) => (
              <PreferenceRow key={p.id} preference={p} busy={busyId === p.id} onConfirm={() => act(p.id, "confirm")} onReject={() => act(p.id, "reject")} />
            ))}
          </div>
        )}

        {rejected.length > 0 && (
          <div className="mt-4 border-t border-border pt-3">
            <button onClick={() => setShowRejected((v) => !v)} className="text-xs text-muted underline underline-offset-4">
              {showRejected ? "Nascondi" : "Mostra"} {rejected.length} rifiutati
            </button>
            {showRejected && (
              <div className="mt-2 space-y-2">
                {rejected.map((p) => (
                  <div key={p.id} className="flex items-start justify-between gap-2 rounded-lg bg-surface-2 p-3 text-sm opacity-60">
                    <div>
                      <span className="mb-1 inline-block rounded-full bg-surface px-2 py-0.5 text-[10px] font-medium text-muted">
                        {p.categoryLabel}
                      </span>
                      <p className="text-foreground/80 line-through decoration-muted">{p.insight}</p>
                    </div>
                    <button
                      onClick={() => act(p.id, "reactivate")}
                      disabled={busyId === p.id}
                      className="shrink-0 text-[11px] text-accent underline underline-offset-4 disabled:opacity-50"
                    >
                      Riattiva
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function PreferenceRow({
  preference,
  busy,
  onConfirm,
  onReject,
}: {
  preference: Preference;
  busy: boolean;
  onConfirm: () => void;
  onReject: () => void;
}) {
  const isConfirmed = preference.reviewState === "CONFIRMED";
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg bg-surface-2 p-3 text-sm">
      <div>
        <div className="mb-1 flex flex-wrap items-center gap-1.5">
          <span className="inline-block rounded-full bg-surface px-2 py-0.5 text-[10px] font-medium text-muted">
            {preference.categoryLabel}
          </span>
          {isConfirmed ? (
            <span className="inline-block rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-medium text-accent">Confermato</span>
          ) : (
            <span className="text-[10px] text-muted">osservato {preference.evidenceCount} volte, non confermato</span>
          )}
        </div>
        <p className="text-foreground/90">{preference.insight}</p>
      </div>
      {!isConfirmed && (
        <div className="flex shrink-0 flex-col items-end gap-1 text-[11px]">
          <button onClick={onConfirm} disabled={busy} className="text-accent underline underline-offset-4 disabled:opacity-50">
            Conferma
          </button>
          <button onClick={onReject} disabled={busy} className="text-muted underline underline-offset-4 hover:text-negative disabled:opacity-50">
            Rifiuta
          </button>
        </div>
      )}
    </div>
  );
}
