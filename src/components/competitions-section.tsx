"use client";

import { useEffect, useState } from "react";
import { trackClient } from "@/lib/track-client";

type CompetitionType = "TOURNAMENT" | "MATCH" | "CHAMPIONSHIP" | "LEAGUE" | "FRIENDLY" | "OTHER";
type CompetitionResult = "WIN" | "LOSS" | "DRAW" | "NOT_RECORDED";

type Competition = {
  id: string;
  name: string;
  type: CompetitionType;
  scheduledAt: string;
  location: string | null;
  opponent: string | null;
  importance: string | null;
  preNotes: string | null;
  postNotes: string | null;
  result: CompetitionResult;
  score: string | null;
  aiPostAnalysis: string | null;
  aiPreAnalysis: string | null;
};

const TYPE_LABEL: Record<CompetitionType, string> = {
  TOURNAMENT: "Torneo",
  MATCH: "Partita",
  CHAMPIONSHIP: "Campionato",
  LEAGUE: "Campionato a girone",
  FRIENDLY: "Amichevole",
  OTHER: "Altro",
};

const RESULT_LABEL: Record<CompetitionResult, string> = { WIN: "Vittoria", LOSS: "Sconfitta", DRAW: "Pareggio", NOT_RECORDED: "Da registrare" };
const RESULT_STYLE: Record<CompetitionResult, string> = {
  WIN: "bg-positive/15 text-positive",
  LOSS: "bg-negative/15 text-negative",
  DRAW: "bg-surface-2 text-muted",
  NOT_RECORDED: "bg-accent/15 text-accent",
};

/** Shared "Competizioni" section for both an athlete and a team page. */
export function CompetitionsSection({ basePath }: { basePath: string }) {
  const [competitions, setCompetitions] = useState<Competition[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch(`${basePath}/competitions`);
    const data = await res.json();
    if (res.ok) setCompetitions(data.competitions ?? []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- basePath is fixed for the component's lifetime
  }, [basePath]);

  const now = Date.now();
  const upcoming = (competitions ?? []).filter((c) => new Date(c.scheduledAt).getTime() >= now).sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt));
  const past = (competitions ?? []).filter((c) => new Date(c.scheduledAt).getTime() < now);

  return (
    <div className="mb-8 rounded-xl border border-border bg-surface p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Competizioni</h2>
        <button onClick={() => setShowForm(true)} className="text-xs text-accent underline underline-offset-4">
          + Nuova competizione
        </button>
      </div>

      {error && <p className="mb-2 text-xs text-negative">{error}</p>}

      {competitions === null ? (
        <p className="text-sm text-muted">Caricamento…</p>
      ) : competitions.length === 0 ? (
        <p className="text-sm text-muted">Nessuna competizione ancora.</p>
      ) : (
        <div className="space-y-2">
          {upcoming.map((c) => (
            <CompetitionCard key={c.id} competition={c} basePath={basePath} upcoming onError={setError} onUpdated={load} />
          ))}
          {past.map((c) => (
            <CompetitionCard key={c.id} competition={c} basePath={basePath} upcoming={false} onError={setError} onUpdated={load} />
          ))}
        </div>
      )}

      {showForm && (
        <NewCompetitionForm
          basePath={basePath}
          onClose={() => setShowForm(false)}
          onCreated={() => {
            setShowForm(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function CompetitionCard({
  competition,
  basePath,
  upcoming,
  onError,
  onUpdated,
}: {
  competition: Competition;
  basePath: string;
  upcoming: boolean;
  onError: (msg: string | null) => void;
  onUpdated: () => void;
}) {
  const [showResultForm, setShowResultForm] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function deleteCompetition() {
    if (!confirm("Eliminare questa competizione? L'evento collegato nel calendario verrà rimosso. L'azione non è reversibile.")) return;
    setDeleting(true);
    onError(null);
    const res = await fetch(`${basePath}/competitions/${competition.id}`, { method: "DELETE" });
    setDeleting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      onError(data.error ?? "Errore durante l'eliminazione.");
      return;
    }
    trackClient("competition_deleted", {});
    onUpdated();
  }

  async function generatePreparation() {
    setPreparing(true);
    onError(null);
    const res = await fetch(`${basePath}/competitions/${competition.id}/prepare`, { method: "POST" });
    const data = await res.json();
    setPreparing(false);
    if (!res.ok) {
      onError(data.error ?? "Errore durante la generazione della preparazione.");
      return;
    }
    trackClient("competition_prepared", {});
    onUpdated();
  }

  const daysUntil = Math.ceil((+new Date(competition.scheduledAt) - Date.now()) / (24 * 60 * 60 * 1000));

  return (
    <div className="rounded-lg bg-surface-2 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{competition.name}</p>
          <p className="mt-0.5 text-xs text-muted">
            {TYPE_LABEL[competition.type]} · {new Date(competition.scheduledAt).toLocaleString("it-IT", { dateStyle: "medium", timeStyle: "short" })}
            {competition.opponent ? ` · vs ${competition.opponent}` : ""}
            {competition.location ? ` · ${competition.location}` : ""}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${RESULT_STYLE[competition.result]}`}>
          {competition.result === "NOT_RECORDED" ? (upcoming ? "In programma" : "Da registrare") : `${RESULT_LABEL[competition.result]}${competition.score ? ` ${competition.score}` : ""}`}
        </span>
      </div>

      {competition.preNotes && <p className="mt-2 text-xs text-foreground/80">Preparazione: {competition.preNotes}</p>}
      {competition.postNotes && <p className="mt-2 text-xs text-foreground/80">Osservazioni: {competition.postNotes}</p>}
      {competition.aiPreAnalysis && (
        <p className="mt-2 rounded-md bg-surface p-2 text-xs text-muted">
          <span className="font-medium text-accent">Preparazione AI: </span>
          {competition.aiPreAnalysis}
        </p>
      )}
      {competition.aiPostAnalysis && <p className="mt-2 rounded-md bg-surface p-2 text-xs text-muted">{competition.aiPostAnalysis}</p>}

      <div className="mt-2 flex flex-wrap gap-2">
        {upcoming && (
          <button
            onClick={generatePreparation}
            disabled={preparing}
            className="rounded-md border border-border px-2 py-1 text-[11px] transition-colors hover:bg-surface disabled:opacity-50"
          >
            {preparing
              ? "Generazione…"
              : competition.aiPreAnalysis
                ? "Rigenera preparazione AI"
                : `Genera preparazione AI (${daysUntil} ${daysUntil === 1 ? "giorno" : "giorni"})`}
          </button>
        )}
        {!upcoming && competition.result === "NOT_RECORDED" && !showResultForm && (
          <button
            onClick={() => setShowResultForm(true)}
            className="rounded-md border border-border px-2 py-1 text-[11px] transition-colors hover:bg-surface"
          >
            Registra risultato
          </button>
        )}
        <button
          onClick={deleteCompetition}
          disabled={deleting}
          className="rounded-md border border-border px-2 py-1 text-[11px] text-muted transition-colors hover:border-negative/40 hover:text-negative disabled:opacity-50"
        >
          {deleting ? "…" : "Elimina"}
        </button>
      </div>

      {showResultForm && (
        <RecordResultForm
          basePath={basePath}
          competitionId={competition.id}
          onClose={() => setShowResultForm(false)}
          onSaved={(aiError) => {
            setShowResultForm(false);
            onUpdated();
            if (aiError) onError(aiError);
          }}
        />
      )}
    </div>
  );
}

function RecordResultForm({
  basePath,
  competitionId,
  onClose,
  onSaved,
}: {
  basePath: string;
  competitionId: string;
  onClose: () => void;
  onSaved: (aiError?: string) => void;
}) {
  const [result, setResult] = useState<CompetitionResult>("WIN");
  const [score, setScore] = useState("");
  const [postNotes, setPostNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch(`${basePath}/competitions/${competitionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ result, score: score || undefined, postNotes: postNotes || undefined }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Errore durante il salvataggio.");
      return;
    }
    trackClient("competition_result_recorded", {});
    onSaved(data.aiError);
  }

  return (
    <form onSubmit={submit} className="mt-2 space-y-2 rounded-md border border-dashed border-border p-3">
      <div className="flex gap-2">
        <select
          value={result}
          onChange={(e) => setResult(e.target.value as CompetitionResult)}
          className="rounded-md border border-border bg-surface px-2 py-1 text-xs outline-none focus:border-accent"
        >
          <option value="WIN">Vittoria</option>
          <option value="LOSS">Sconfitta</option>
          <option value="DRAW">Pareggio</option>
        </select>
        <input
          value={score}
          onChange={(e) => setScore(e.target.value)}
          placeholder="Punteggio (es. 6-3 6-4)"
          className="flex-1 rounded-md border border-border bg-surface px-2 py-1 text-xs outline-none focus:border-accent"
        />
      </div>
      <textarea
        value={postNotes}
        onChange={(e) => setPostNotes(e.target.value)}
        rows={2}
        placeholder="Osservazioni: cosa ha funzionato, cosa no…"
        className="w-full resize-none rounded-md border border-border bg-surface px-2 py-1 text-xs outline-none focus:border-accent"
      />
      {error && <p className="text-xs text-negative">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="rounded-md bg-accent px-3 py-1 text-xs font-medium text-black disabled:opacity-50">
          {busy ? "Salvataggio…" : "Salva risultato"}
        </button>
        <button type="button" onClick={onClose} className="rounded-md border border-border px-3 py-1 text-xs hover:bg-surface">
          Annulla
        </button>
      </div>
    </form>
  );
}

function NewCompetitionForm({ basePath, onClose, onCreated }: { basePath: string; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState<CompetitionType>("MATCH");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("18:00");
  const [location, setLocation] = useState("");
  const [opponent, setOpponent] = useState("");
  const [preNotes, setPreNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!date) {
      setError("Seleziona una data.");
      return;
    }
    setBusy(true);
    setError(null);
    const scheduledAt = new Date(`${date}T${time}`).toISOString();
    const res = await fetch(`${basePath}/competitions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        type,
        scheduledAt,
        location: location || undefined,
        opponent: opponent || undefined,
        preNotes: preNotes || undefined,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Errore durante la creazione.");
      return;
    }
    trackClient("competition_created", {});
    onCreated();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm animate-scale-in space-y-3 rounded-xl border border-border bg-surface p-6"
      >
        <h2 className="text-lg font-semibold">Nuova competizione</h2>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted">Nome</label>
          <input
            required
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
            placeholder="Es. Torneo Open Città"
          />
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="mb-1.5 block text-xs font-medium text-muted">Tipo</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as CompetitionType)}
              className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
            >
              {Object.entries(TYPE_LABEL).map(([t, label]) => (
                <option key={t} value={t}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="mb-1.5 block text-xs font-medium text-muted">Data</label>
            <input
              required
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1.5 block text-xs font-medium text-muted">Ora</label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <input
            value={opponent}
            onChange={(e) => setOpponent(e.target.value)}
            placeholder="Avversario (opzionale)"
            className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Luogo (opzionale)"
            className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted">Note di preparazione (opzionale)</label>
          <textarea
            value={preNotes}
            onChange={(e) => setPreNotes(e.target.value)}
            rows={2}
            className="w-full resize-none rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>

        {error && <p className="text-sm text-negative">{error}</p>}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={busy}
            className="flex-1 rounded-md bg-accent py-2 text-sm font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Creazione…" : "Crea competizione"}
          </button>
          <button type="button" onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-surface-2">
            Annulla
          </button>
        </div>
      </form>
    </div>
  );
}
