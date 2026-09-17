"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatRelativeDate, formatDate } from "@/lib/format";
import { trackClient } from "@/lib/track-client";
import type { AthleteData, SessionNoteData } from "./types";
import { ObjectivesSection } from "@/components/objectives-section";
import { EvaluationsSection } from "@/components/evaluations-section";
import { CompetitionsSection } from "@/components/competitions-section";
import { VoiceInputButton } from "@/components/voice-input-button";
import { Tabs } from "@/components/tabs";
import { NextBestActionCard } from "@/components/next-best-action-card";
import { AthleteChatCard } from "@/components/athlete-chat-card";
import { PaymentsSection } from "@/components/payments-section";
import { CheckinSection } from "@/components/checkin-section";
import { MetricsSection } from "@/components/metrics-section";
import { BaselineSection } from "@/components/baseline-section";
import { DigitalTwinSection } from "@/components/digital-twin-section";
import { WeeklyPlanSection } from "@/components/weekly-plan-section";
import { InjuriesSection, InjuryStatusBadge } from "@/components/injuries-section";
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog";

const SENTIMENT_STYLE: Record<string, string> = {
  POSITIVE: "bg-positive/15 text-positive",
  NEGATIVE: "bg-negative/15 text-negative",
  IMPROVING: "bg-improving/15 text-improving",
  NEUTRAL: "bg-surface-2 text-muted",
};

const SENTIMENT_LABEL: Record<string, string> = {
  POSITIVE: "Punto di forza",
  NEGATIVE: "Da lavorare",
  IMPROVING: "In miglioramento",
  NEUTRAL: "Osservazione",
};

export function AthleteClient({
  initialData,
  aiConfigured,
  stripeConfigured,
}: {
  initialData: AthleteData;
  aiConfigured: boolean;
  stripeConfigured: boolean;
}) {
  const router = useRouter();
  const [athlete, setAthlete] = useState(initialData);
  const [noteText, setNoteText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionDuration, setSessionDuration] = useState("60");
  const [sessionObjective, setSessionObjective] = useState("");
  const [generatingSession, setGeneratingSession] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function generateSession(e: React.FormEvent) {
    e.preventDefault();
    setGeneratingSession(true);
    setError(null);
    const res = await fetch(`/api/athletes/${athlete.id}/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        durationMinutes: Number(sessionDuration) || 60,
        objective: sessionObjective || undefined,
      }),
    });
    const data = await res.json();
    setGeneratingSession(false);
    if (!res.ok) {
      setError(data.error ?? "Errore durante la generazione della sessione.");
      return;
    }
    trackClient("training_session_generated", { athleteId: athlete.id });
    router.push(`/sessions/${data.sessionId}`);
  }

  async function submitNote(e: React.FormEvent) {
    e.preventDefault();
    if (!noteText.trim()) return;
    setSaving(true);
    setError(null);

    const res = await fetch(`/api/athletes/${athlete.id}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rawText: noteText }),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data.error ?? "Errore durante il salvataggio.");
      return;
    }

    const newNote: SessionNoteData = {
      id: data.note.id,
      rawText: data.note.rawText,
      sessionDate: data.note.sessionDate,
      aiProcessed: data.note.aiProcessed,
      tags: (data.note.tags ?? []).map((t: { sentiment: string; excerpt: string; skill: { name: string } }) => ({
        skillName: t.skill.name,
        sentiment: t.sentiment,
        excerpt: t.excerpt,
      })),
    };

    setAthlete((prev) => ({
      ...prev,
      notes: [newNote, ...prev.notes],
      aiSummary: data.athleteSummary?.summary ?? prev.aiSummary,
      aiPriorities: data.athleteSummary?.priorities ?? prev.aiPriorities,
    }));
    setNoteText("");
    trackClient("session_note_created", { athleteId: athlete.id });
  }

  async function deleteAthlete(forgetAiMemory: boolean) {
    setDeleting(true);
    const res = await fetch(`/api/athletes/${athlete.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ forgetAiMemory }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setDeleting(false);
      setShowDeleteDialog(false);
      setError(data.error ?? "Errore durante l'eliminazione.");
      return;
    }
    trackClient("athlete_deleted", { athleteId: athlete.id, forgetAiMemory });
    router.push("/dashboard");
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 sm:px-6">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{athlete.name}</h1>
          <p className="mt-1 text-sm text-muted">
            {athlete.sportName}
            {athlete.level ? ` · ${athlete.level}` : ""}
          </p>
          <div className="mt-2">
            <InjuryStatusBadge basePath={`/api/athletes/${athlete.id}`} />
          </div>
          {athlete.objectives && <p className="mt-2 text-sm text-foreground/80">{athlete.objectives}</p>}
        </div>
        {!athlete.isSelf && (
          <button onClick={() => setShowDeleteDialog(true)} className="shrink-0 text-xs text-muted transition-colors hover:text-negative">
            Elimina atleta
          </button>
        )}
      </div>

      {showDeleteDialog && (
        <DeleteConfirmDialog
          title={`Eliminare ${athlete.name}?`}
          description="Verranno rimossi anche note, sessioni, valutazioni, obiettivi, competizioni, eventi in calendario e acquisti collegati. L'azione non è reversibile."
          memoryLabel={`Elimina anche ciò che l'AI ha imparato osservando le tue interazioni con ${athlete.name} (esercizi sostituiti, sessioni valutate, raccomandazioni giudicate utili o meno). Se non selezioni questa opzione, quelle osservazioni continueranno a contribuire ai suggerimenti futuri.`}
          busy={deleting}
          onCancel={() => setShowDeleteDialog(false)}
          onConfirm={deleteAthlete}
        />
      )}

      {!aiConfigured && (
        <div className="mb-6 rounded-lg border border-improving/30 bg-improving/10 px-4 py-3 text-sm text-improving">
          L&apos;AI non è ancora configurata (manca GEMINI_API_KEY). Le note si salvano comunque, ma non vengono
          ancora analizzate automaticamente.
        </div>
      )}

      <Tabs
        tabs={[
          {
            id: "overview",
            label: "Panoramica",
            content: (
              <>
                {aiConfigured && <NextBestActionCard basePath={`/api/athletes/${athlete.id}`} showDiagnose />}
                {aiConfigured && <WeeklyPlanSection basePath={`/api/athletes/${athlete.id}`} />}
                {aiConfigured && <AthleteChatCard basePath={`/api/athletes/${athlete.id}`} />}

                {/* AI summary / priorities */}
                <div className="mb-6 rounded-xl border border-border bg-surface p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Sintesi AI</h2>
                    {athlete.aiSummaryUpdatedAt && (
                      <span className="text-xs text-muted">Aggiornata {formatRelativeDate(athlete.aiSummaryUpdatedAt)}</span>
                    )}
                  </div>
                  {athlete.aiSummary ? (
                    <>
                      <p className="text-sm text-foreground/90">{athlete.aiSummary}</p>
                      {athlete.aiPriorities.length > 0 && (
                        <div className="mt-4 space-y-2">
                          {athlete.aiPriorities.map((p, i) => (
                            <div key={i} className="rounded-lg bg-surface-2 p-3">
                              <p className="text-sm font-medium text-accent">{p.skill}</p>
                              <p className="mt-0.5 text-xs text-muted">{p.reason}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-muted">
                      {aiConfigured
                        ? "Aggiungi la prima nota di sessione per vedere qui la sintesi e le priorità."
                        : "Configura l'AI per vedere qui sintesi e priorità basate sullo storico."}
                    </p>
                  )}
                </div>

                {/* Session generator — the core "wow moment": priorities + exercise library -> a real session plan */}
                {aiConfigured && (
                  <form onSubmit={generateSession} className="mb-6 rounded-xl border border-border bg-surface p-5">
                    <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">Genera sessione</h2>
                    <div className="flex flex-wrap items-end gap-3">
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-muted">Durata (min)</label>
                        <input
                          type="number"
                          min={10}
                          max={240}
                          value={sessionDuration}
                          onChange={(e) => setSessionDuration(e.target.value)}
                          className="w-24 rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
                        />
                      </div>
                      <div className="flex-1 min-w-[200px]">
                        <label className="mb-1.5 block text-xs font-medium text-muted">Obiettivo specifico (opzionale)</label>
                        <input
                          value={sessionObjective}
                          onChange={(e) => setSessionObjective(e.target.value)}
                          placeholder="Es. lavoro sulla difesa in pressione"
                          className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={generatingSession}
                        className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50"
                      >
                        {generatingSession ? "Generazione…" : "Genera con AI"}
                      </button>
                    </div>
                    <p className="mt-2 text-xs text-muted">Usa prima la tua libreria esercizi, genera nuovi esercizi solo se necessario.</p>
                  </form>
                )}

                {/* Quick note capture */}
                <form onSubmit={submitNote} className="rounded-xl border border-border bg-surface p-5">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Nuova nota di sessione</h2>
                    <VoiceInputButton onResult={(text) => setNoteText((prev) => (prev ? `${prev} ${text}` : text))} />
                  </div>
                  <textarea
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    rows={3}
                    placeholder="Es. Oggi buona esecuzione in attacco, ma arriva in ritardo sulle palle profonde…"
                    className="w-full resize-none rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
                  />
                  {error && <p className="mt-2 text-sm text-negative">{error}</p>}
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-muted">Scrivi come parleresti a un collega — l&apos;AI struttura il resto.</p>
                    <button
                      type="submit"
                      disabled={saving || !noteText.trim()}
                      className="shrink-0 whitespace-nowrap rounded-md bg-accent px-4 py-2 text-sm font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                      {saving ? "Analisi in corso…" : "Salva nota"}
                    </button>
                  </div>
                </form>
              </>
            ),
          },
          {
            id: "profile",
            label: "Profilo",
            content: <DigitalTwinSection basePath={`/api/athletes/${athlete.id}`} />,
          },
          {
            id: "development",
            label: "Sviluppo",
            content: (
              <>
                <ObjectivesSection basePath={`/api/athletes/${athlete.id}/objectives`} initialGoals={athlete.goals} />
                <MetricsSection basePath={`/api/athletes/${athlete.id}`} />
                <BaselineSection basePath={`/api/athletes/${athlete.id}`} />
                <EvaluationsSection basePath={`/api/athletes/${athlete.id}`} />
              </>
            ),
          },
          ...(athlete.isSelf
            ? [
                {
                  id: "checkin",
                  label: "Check-in",
                  content: <CheckinSection basePath={`/api/athletes/${athlete.id}`} />,
                },
              ]
            : []),
          {
            id: "injuries",
            label: "Infortuni",
            content: <InjuriesSection basePath={`/api/athletes/${athlete.id}`} />,
          },
          {
            id: "competitions",
            label: "Competizioni",
            content: <CompetitionsSection basePath={`/api/athletes/${athlete.id}`} />,
          },
          ...(athlete.isSelf
            ? []
            : [
                {
                  id: "payments",
                  label: "Pagamenti",
                  content: <PaymentsSection basePath={`/api/athletes/${athlete.id}`} stripeConfigured={stripeConfigured} />,
                },
              ]),
          {
            id: "history",
            label: "Storico",
            content:
              athlete.notes.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">
                  Nessuna sessione registrata ancora.
                </p>
              ) : (
                <div className="space-y-3">
                  {athlete.notes.map((note) => (
                    <div key={note.id} className="rounded-xl border border-border bg-surface p-4">
                      <p className="text-xs text-muted">{formatDate(note.sessionDate)}</p>
                      <p className="mt-1.5 text-sm text-foreground/90">{note.rawText}</p>
                      {note.tags.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {note.tags.map((t, i) => (
                            <span key={i} className={`rounded-full px-2.5 py-1 text-xs ${SENTIMENT_STYLE[t.sentiment]}`}>
                              {t.skillName} · {SENTIMENT_LABEL[t.sentiment]}
                            </span>
                          ))}
                        </div>
                      ) : !note.aiProcessed && aiConfigured ? (
                        <p className="mt-2 text-xs text-muted">In elaborazione…</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              ),
          },
        ]}
      />
    </div>
  );
}
