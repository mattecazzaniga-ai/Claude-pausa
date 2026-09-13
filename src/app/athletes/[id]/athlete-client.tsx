"use client";

import { useState } from "react";
import { formatRelativeDate, formatDate } from "@/lib/format";
import { trackClient } from "@/lib/track-client";
import type { AthleteData, SessionNoteData } from "./types";

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

export function AthleteClient({ initialData, aiConfigured }: { initialData: AthleteData; aiConfigured: boolean }) {
  const [athlete, setAthlete] = useState(initialData);
  const [noteText, setNoteText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">{athlete.name}</h1>
        <p className="mt-1 text-sm text-muted">
          {athlete.sportName}
          {athlete.level ? ` · ${athlete.level}` : ""}
        </p>
        {athlete.objectives && <p className="mt-2 text-sm text-foreground/80">{athlete.objectives}</p>}
      </div>

      {!aiConfigured && (
        <div className="mb-6 rounded-lg border border-improving/30 bg-improving/10 px-4 py-3 text-sm text-improving">
          L&apos;AI non è ancora configurata (manca GEMINI_API_KEY). Le note si salvano comunque, ma non vengono
          ancora analizzate automaticamente.
        </div>
      )}

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

      {/* Quick note capture */}
      <form onSubmit={submitNote} className="mb-8 rounded-xl border border-border bg-surface p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">Nuova nota di sessione</h2>
        <textarea
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          rows={3}
          placeholder="Es. Oggi buona esecuzione in attacco, ma arriva in ritardo sulle palle profonde…"
          className="w-full resize-none rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
        />
        {error && <p className="mt-2 text-sm text-negative">{error}</p>}
        <div className="mt-3 flex items-center justify-between">
          <p className="text-xs text-muted">Scrivi come parleresti a un collega — l&apos;AI struttura il resto.</p>
          <button
            type="submit"
            disabled={saving || !noteText.trim()}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Analisi in corso…" : "Salva nota"}
          </button>
        </div>
      </form>

      {/* Timeline */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">Storico sessioni</h2>
        {athlete.notes.length === 0 ? (
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
        )}
      </div>
    </div>
  );
}
