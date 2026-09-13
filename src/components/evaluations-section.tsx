"use client";

import { useEffect, useState } from "react";
import { trackClient } from "@/lib/track-client";

export type ScoreType =
  | "SCALE_1_5"
  | "SCALE_1_10"
  | "PERCENTAGE"
  | "TIME_SECONDS"
  | "DISTANCE_METERS"
  | "REPETITIONS"
  | "SUCCESS_RATE"
  | "CUSTOM_NUMERIC"
  | "QUALITATIVE";

type Criterion = { id: string; category: string; name: string; scoreType: ScoreType; targetLevel: string | null; coachId: string | null };
type EvaluationScore = { criterionId: string; value: string; note: string | null };
type EvaluationItem = {
  id: string;
  kind: "INITIAL" | "PERIODIC";
  evaluatedAt: string;
  notes: string | null;
  aiAnalysis: string | null;
  scores: EvaluationScore[];
};
type ComparisonRow = { criterionId: string; category: string; name: string; scoreType: ScoreType; baseline: string | null; previous: string | null; current: string | null };

const SCORE_TYPE_SUFFIX: Record<ScoreType, string> = {
  SCALE_1_5: "/5",
  SCALE_1_10: "/10",
  PERCENTAGE: "%",
  TIME_SECONDS: "s",
  DISTANCE_METERS: "m",
  REPETITIONS: "",
  SUCCESS_RATE: "%",
  CUSTOM_NUMERIC: "",
  QUALITATIVE: "",
};

const SCORE_TYPE_LABEL: Record<ScoreType, string> = {
  SCALE_1_5: "Scala 1-5",
  SCALE_1_10: "Scala 1-10",
  PERCENTAGE: "Percentuale",
  TIME_SECONDS: "Tempo (secondi)",
  DISTANCE_METERS: "Distanza (metri)",
  REPETITIONS: "Ripetizioni",
  SUCCESS_RATE: "Tasso di successo (%)",
  CUSTOM_NUMERIC: "Numero personalizzato",
  QUALITATIVE: "Valutazione qualitativa",
};

function fmt(value: string | null, scoreType: ScoreType): string {
  if (value === null) return "—";
  return `${value}${SCORE_TYPE_SUFFIX[scoreType]}`;
}

/** Shared "Valutazioni" section for both an athlete and a team page. */
export function EvaluationsSection({ basePath }: { basePath: string }) {
  const [criteria, setCriteria] = useState<Criterion[] | null>(null);
  const [evaluations, setEvaluations] = useState<EvaluationItem[] | null>(null);
  const [comparison, setComparison] = useState<ComparisonRow[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch(`${basePath}/evaluations`);
    const data = await res.json();
    if (res.ok) {
      setCriteria(data.criteria ?? []);
      setEvaluations(data.evaluations ?? []);
      setComparison(data.comparison ?? []);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- basePath is fixed for the component's lifetime
  }, [basePath]);

  return (
    <div className="mb-8 rounded-xl border border-border bg-surface p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Valutazioni</h2>
        <button onClick={() => setShowForm(true)} className="text-xs text-accent underline underline-offset-4">
          + Nuova valutazione
        </button>
      </div>

      {error && <p className="mb-2 text-xs text-negative">{error}</p>}

      {comparison.length > 0 && (
        <div className="mb-4 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-muted">
                <th className="pb-1.5 pr-3 font-medium">Criterio</th>
                <th className="pb-1.5 pr-3 font-medium">Baseline</th>
                <th className="pb-1.5 pr-3 font-medium">Precedente</th>
                <th className="pb-1.5 font-medium">Attuale</th>
              </tr>
            </thead>
            <tbody>
              {comparison.map((row) => (
                <tr key={row.criterionId} className="border-t border-border">
                  <td className="py-1.5 pr-3">
                    <span className="text-muted">{row.category}</span> · {row.name}
                  </td>
                  <td className="py-1.5 pr-3 text-muted">{fmt(row.baseline, row.scoreType)}</td>
                  <td className="py-1.5 pr-3 text-muted">{fmt(row.previous, row.scoreType)}</td>
                  <td className="py-1.5 font-medium text-accent">{fmt(row.current, row.scoreType)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {evaluations === null ? (
        <p className="text-sm text-muted">Caricamento…</p>
      ) : evaluations.length === 0 ? (
        <p className="text-sm text-muted">Nessuna valutazione registrata ancora.</p>
      ) : (
        <div className="space-y-2">
          {evaluations.map((ev) => (
            <div key={ev.id} className="rounded-lg bg-surface-2 p-3 text-sm">
              <p className="text-xs text-muted">
                {ev.kind === "INITIAL" ? "Valutazione iniziale" : "Valutazione periodica"} ·{" "}
                {new Date(ev.evaluatedAt).toLocaleDateString("it-IT")}
              </p>
              {ev.notes && <p className="mt-1 text-foreground/80">{ev.notes}</p>}
              {ev.aiAnalysis && <p className="mt-2 rounded-md bg-surface p-2 text-xs text-muted">{ev.aiAnalysis}</p>}
            </div>
          ))}
        </div>
      )}

      {showForm && criteria && (
        <NewEvaluationForm
          basePath={basePath}
          criteria={criteria}
          onClose={() => setShowForm(false)}
          onCreated={() => {
            setShowForm(false);
            load();
          }}
          onCriteriaChanged={(updated) => setCriteria(updated)}
          onError={setError}
        />
      )}
    </div>
  );
}

function NewEvaluationForm({
  basePath,
  criteria,
  onClose,
  onCreated,
  onCriteriaChanged,
  onError,
}: {
  basePath: string;
  criteria: Criterion[];
  onClose: () => void;
  onCreated: () => void;
  onCriteriaChanged: (criteria: Criterion[]) => void;
  onError: (msg: string | null) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [showAddCriterion, setShowAddCriterion] = useState(false);

  const grouped = criteria.reduce<Record<string, Criterion[]>>((acc, c) => {
    (acc[c.category] ??= []).push(c);
    return acc;
  }, {});

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const scores = Object.entries(values)
      .filter(([, v]) => v.trim().length > 0)
      .map(([criterionId, value]) => ({ criterionId, value: value.trim() }));
    if (scores.length === 0) {
      setLocalError("Inserisci almeno un punteggio.");
      return;
    }
    setBusy(true);
    setLocalError(null);
    onError(null);
    const res = await fetch(`${basePath}/evaluations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: notes || undefined, scores }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setLocalError(data.error ?? "Errore durante il salvataggio.");
      return;
    }
    if (data.aiError) onError(data.aiError);
    trackClient("evaluation_created", {});
    onCreated();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full max-w-lg animate-scale-in space-y-4 overflow-y-auto rounded-xl border border-border bg-surface p-6"
      >
        <h2 className="text-lg font-semibold">Nuova valutazione</h2>
        <p className="text-xs text-muted">Compila solo i criteri che vuoi valutare ora.</p>

        {Object.entries(grouped).map(([category, items]) => (
          <div key={category}>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted">{category}</p>
            <div className="space-y-2">
              {items.map((c) => (
                <div key={c.id} className="flex items-center gap-2">
                  <label className="flex-1 text-sm">
                    {c.name}
                    {c.coachId && <span className="ml-1 text-[10px] text-accent">(personalizzato)</span>}
                  </label>
                  {c.scoreType === "QUALITATIVE" ? (
                    <input
                      value={values[c.id] ?? ""}
                      onChange={(e) => setValues((v) => ({ ...v, [c.id]: e.target.value }))}
                      placeholder="Osservazione"
                      className="w-40 rounded-md border border-border bg-surface-2 px-2 py-1 text-sm outline-none focus:border-accent"
                    />
                  ) : (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={values[c.id] ?? ""}
                        onChange={(e) => setValues((v) => ({ ...v, [c.id]: e.target.value }))}
                        className="w-20 rounded-md border border-border bg-surface-2 px-2 py-1 text-sm outline-none focus:border-accent"
                      />
                      <span className="text-xs text-muted">{SCORE_TYPE_SUFFIX[c.scoreType]}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={() => setShowAddCriterion((v) => !v)}
          className="text-xs text-accent underline underline-offset-4"
        >
          {showAddCriterion ? "Annulla" : "+ Criterio personalizzato"}
        </button>
        {showAddCriterion && (
          <AddCriterionInline
            onAdded={(c) => {
              onCriteriaChanged([...criteria, c]);
              setShowAddCriterion(false);
            }}
          />
        )}

        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted">Note (opzionale)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full resize-none rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>

        {localError && <p className="text-sm text-negative">{localError}</p>}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={busy}
            className="flex-1 rounded-md bg-accent py-2 text-sm font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Salvataggio…" : "Salva valutazione"}
          </button>
          <button type="button" onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-surface-2">
            Annulla
          </button>
        </div>
      </form>
    </div>
  );
}

function AddCriterionInline({ onAdded }: { onAdded: (c: Criterion) => void }) {
  const [category, setCategory] = useState("");
  const [name, setName] = useState("");
  const [scoreType, setScoreType] = useState<ScoreType>("SCALE_1_10");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    if (!category.trim() || !name.trim()) {
      setError("Categoria e nome sono obbligatori.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch("/api/coach/evaluation-criteria", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, name, scoreType }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Errore durante la creazione.");
      return;
    }
    onAdded(data.criterion);
    trackClient("evaluation_criterion_created", {});
  }

  return (
    <div className="rounded-md border border-dashed border-border p-3">
      <div className="flex flex-wrap gap-2">
        <input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Categoria"
          className="flex-1 rounded-md border border-border bg-surface-2 px-2 py-1 text-xs outline-none focus:border-accent"
        />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome criterio"
          className="flex-1 rounded-md border border-border bg-surface-2 px-2 py-1 text-xs outline-none focus:border-accent"
        />
        <select
          value={scoreType}
          onChange={(e) => setScoreType(e.target.value as ScoreType)}
          className="rounded-md border border-border bg-surface-2 px-2 py-1 text-xs outline-none focus:border-accent"
        >
          {Object.entries(SCORE_TYPE_LABEL).map(([type, label]) => (
            <option key={type} value={type}>
              {label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={add}
          disabled={busy}
          className="rounded-md bg-accent px-3 py-1 text-xs font-medium text-black disabled:opacity-50"
        >
          {busy ? "…" : "Aggiungi"}
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-negative">{error}</p>}
    </div>
  );
}
