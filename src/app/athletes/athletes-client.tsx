"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatRelativeDate } from "@/lib/format";

type OverallInjuryStatus = "NONE" | "MONITORED" | "PARTIAL" | "ACTIVE_INJURY";
const INJURY_DOT: Record<OverallInjuryStatus, string> = { NONE: "", MONITORED: "🟡", PARTIAL: "🟠", ACTIVE_INJURY: "🔴" };

type Priority = { skill: string; reason: string };

type AthleteListItem = {
  id: string;
  name: string;
  level: string | null;
  sportName: string;
  lastSessionDate: string | null;
  priorityCount: number;
  topPriority: Priority | null;
  overallInjuryStatus: OverallInjuryStatus;
};

export function AthletesClient() {
  const router = useRouter();
  const [athletes, setAthletes] = useState<AthleteListItem[] | null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetch("/api/athletes")
      .then((res) => res.json())
      .then((data) => setAthletes(data.athletes ?? []));
  }, []);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Atleti</h1>
        <button
          onClick={() => setShowForm(true)}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-black transition-opacity hover:opacity-90"
        >
          + Nuovo atleta
        </button>
      </div>

      <SportProfileCard />

      {athletes === null ? (
        <div className="flex justify-center py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-accent" />
        </div>
      ) : athletes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <p className="text-sm text-muted">Non hai ancora nessun atleta.</p>
          <p className="mt-1 text-xs text-muted">Aggiungi il primo per iniziare a costruire il suo profilo di sviluppo.</p>
          <button onClick={() => setShowForm(true)} className="mt-3 text-sm text-accent underline underline-offset-4">
            Aggiungi il primo
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {athletes.map((a) => (
            <Link
              key={a.id}
              href={`/athletes/${a.id}`}
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4 transition-colors hover:bg-surface-2"
            >
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 font-medium">
                  {a.name}
                  {INJURY_DOT[a.overallInjuryStatus] && <span className="text-xs">{INJURY_DOT[a.overallInjuryStatus]}</span>}
                </p>
                <p className="mt-0.5 truncate text-xs text-muted">
                  {a.sportName}
                  {a.level ? ` · ${a.level}` : ""}
                  {a.lastSessionDate ? ` · ultima sessione ${formatRelativeDate(a.lastSessionDate)}` : " · nessuna sessione ancora"}
                </p>
              </div>
              {a.topPriority && (
                <span className="shrink-0 rounded-full bg-accent/15 px-2.5 py-1 text-xs font-medium text-accent">{a.topPriority.skill}</span>
              )}
            </Link>
          ))}
        </div>
      )}

      {showForm && <NewAthleteForm onClose={() => setShowForm(false)} onCreated={(id) => router.push(`/athletes/${id}`)} />}
    </div>
  );
}

function NewAthleteForm({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState("");
  const [level, setLevel] = useState("");
  const [objectives, setObjectives] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/athletes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, level: level || undefined, objectives: objectives || undefined }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Errore durante la creazione.");
      return;
    }
    onCreated(data.athlete.id);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm animate-scale-in space-y-4 rounded-xl border border-border bg-surface p-6"
      >
        <h2 className="text-lg font-semibold">Nuovo atleta</h2>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted">Nome</label>
          <input
            required
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
            placeholder="Nome e cognome"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted">Livello (opzionale)</label>
          <input
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
            placeholder="Es. Principiante, Intermedio, Agonista"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted">Obiettivi (opzionale)</label>
          <textarea
            value={objectives}
            onChange={(e) => setObjectives(e.target.value)}
            rows={2}
            className="w-full resize-none rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
            placeholder="Su cosa state lavorando in generale"
          />
        </div>

        {error && <p className="text-sm text-negative">{error}</p>}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={busy}
            className="flex-1 rounded-md bg-accent py-2 text-sm font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Creazione…" : "Crea atleta"}
          </button>
          <button type="button" onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-surface-2">
            Annulla
          </button>
        </div>
      </form>
    </div>
  );
}

type SportProfile = {
  formats: string[];
  environment: string;
  equipment: string;
  scoringSystem: string;
  keyRules: string;
  terminology: string;
  positions: string;
  movementPatterns: string;
  gameSituations: string;
  trainingMethods: string;
  commonProblems: string;
  progressions: string;
  safetyNotes: string;
};

type SportMetric = { id: string; name: string; unit: string | null; description: string | null };

/** Reference material about the coach's sport, not an action — kept collapsed by default (progressive disclosure). */
function SportProfileCard() {
  const [sportName, setSportName] = useState<string | null>(null);
  const [profile, setProfile] = useState<SportProfile | null>(null);
  const [metrics, setMetrics] = useState<SportMetric[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/coach/sport-profile")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setSportName(data.sportName);
          setProfile(data.profile);
          setMetrics(data.metrics ?? []);
        }
      });
  }, []);

  async function regenerate() {
    setRegenerating(true);
    setError(null);
    const res = await fetch("/api/coach/sport-profile", { method: "POST" });
    const data = await res.json();
    setRegenerating(false);
    if (!res.ok) {
      setError(data.error ?? "Errore durante la rigenerazione.");
      return;
    }
    setSportName(data.sportName);
    setProfile(data.profile);
    setMetrics(data.metrics ?? []);
  }

  if (!profile) return null;

  const hasContent = profile.environment || profile.equipment || profile.scoringSystem || profile.keyRules || profile.terminology;

  return (
    <div className="mb-6 rounded-xl border border-border bg-surface p-4">
      <button onClick={() => setExpanded((v) => !v)} className="flex w-full items-center justify-between text-left">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted">Profilo AI — {sportName}</span>
        <span className="text-xs text-muted">{expanded ? "Nascondi" : "Mostra"}</span>
      </button>

      {expanded && (
        <div className="mt-3 space-y-2 text-sm">
          {hasContent ? (
            <>
              <p><span className="text-muted">Formato:</span> {profile.formats.join(", ") || "N/D"}</p>
              <p><span className="text-muted">Campo/ambiente:</span> {profile.environment || "N/D"}</p>
              <p><span className="text-muted">Attrezzatura:</span> {profile.equipment || "N/D"}</p>
              <p><span className="text-muted">Punteggio:</span> {profile.scoringSystem || "N/D"}</p>
              <p><span className="text-muted">Regole chiave:</span> {profile.keyRules || "N/D"}</p>
              <p><span className="text-muted">Terminologia:</span> {profile.terminology || "N/D"}</p>
              {profile.positions && <p><span className="text-muted">Ruoli/posizioni:</span> {profile.positions}</p>}
              {profile.movementPatterns && <p><span className="text-muted">Pattern di movimento:</span> {profile.movementPatterns}</p>}
              {profile.gameSituations && <p><span className="text-muted">Situazioni di gioco:</span> {profile.gameSituations}</p>}
              {profile.trainingMethods && <p><span className="text-muted">Metodologie di allenamento:</span> {profile.trainingMethods}</p>}
              {profile.commonProblems && <p><span className="text-muted">Problemi comuni:</span> {profile.commonProblems}</p>}
              {profile.progressions && <p><span className="text-muted">Progressioni:</span> {profile.progressions}</p>}
              {profile.safetyNotes && <p><span className="text-muted">Sicurezza:</span> {profile.safetyNotes}</p>}
              {metrics.length > 0 && (
                <div>
                  <span className="text-muted">Metriche di performance:</span>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4">
                    {metrics.map((m) => (
                      <li key={m.id}>
                        {m.name}
                        {m.unit ? ` (${m.unit})` : ""}
                        {m.description ? ` — ${m.description}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <p className="text-muted">Profilo non ancora generato (verrà creato alla prima nota/esercizio/sessione).</p>
          )}

          <p className="pt-1 text-xs text-muted">
            Trovi un termine sbagliato o preso da uno sport simile (es. termini da padel dentro il beach tennis)? Rigeneralo.
          </p>
          {error && <p className="text-xs text-negative">{error}</p>}
          <button
            onClick={regenerate}
            disabled={regenerating}
            className="mt-1 rounded-md border border-border px-3 py-1.5 text-xs transition-colors hover:bg-surface-2 disabled:opacity-50"
          >
            {regenerating ? "Rigenerazione…" : "Rigenera profilo con AI"}
          </button>
        </div>
      )}
    </div>
  );
}
