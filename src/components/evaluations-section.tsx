"use client";

import { useEffect, useMemo, useState } from "react";
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
  const [showImport, setShowImport] = useState(false);
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

  async function deleteEvaluation(id: string) {
    if (!confirm("Eliminare questa valutazione? L'azione non è reversibile.")) return;
    setError(null);
    const res = await fetch(`${basePath}/evaluations/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const result = await res.json().catch(() => ({}));
      setError(result.error ?? "Errore durante l'eliminazione.");
      return;
    }
    trackClient("evaluation_deleted", {});
    load();
  }

  return (
    <div className="mb-8 rounded-xl border border-border bg-surface p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Valutazioni</h2>
        <div className="flex gap-3">
          <button onClick={() => setShowImport(true)} className="text-xs text-accent underline underline-offset-4">
            Importa criteri da file
          </button>
          <button onClick={() => setShowForm(true)} className="text-xs text-accent underline underline-offset-4">
            + Nuova valutazione
          </button>
        </div>
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

      {criteria && evaluations && <EvaluationTrendChart criteria={criteria} evaluations={evaluations} />}

      {evaluations === null ? (
        <p className="text-sm text-muted">Caricamento…</p>
      ) : evaluations.length === 0 ? (
        <p className="text-sm text-muted">Nessuna valutazione registrata ancora.</p>
      ) : (
        <div className="space-y-2">
          {evaluations.map((ev) => (
            <div key={ev.id} className="rounded-lg bg-surface-2 p-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs text-muted">
                  {ev.kind === "INITIAL" ? "Valutazione iniziale" : "Valutazione periodica"} ·{" "}
                  {new Date(ev.evaluatedAt).toLocaleDateString("it-IT")}
                </p>
                <button
                  onClick={() => deleteEvaluation(ev.id)}
                  className="shrink-0 text-[11px] text-muted transition-colors hover:text-negative"
                  aria-label="Elimina valutazione"
                >
                  Elimina
                </button>
              </div>
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

      {showImport && (
        <ImportCriteriaModal
          onClose={() => setShowImport(false)}
          onSaved={() => {
            setShowImport(false);
            load();
          }}
        />
      )}
    </div>
  );
}

type ImportedCriterionRow = { category: string; name: string; scoreType: ScoreType; targetLevel: string };

/**
 * Master prompt §3-4: upload/paste the coach's own evaluation sheet, AI
 * reads its structure, then the coach reviews every row — editing, deleting
 * or adding — before anything is saved. Nothing here writes to the database
 * until "Salva".
 */
function ImportCriteriaModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [step, setStep] = useState<"upload" | "review">("upload");
  const [mode, setMode] = useState<"file" | "text">("file");
  const [file, setFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState("");
  const [rows, setRows] = useState<ImportedCriterionRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function analyze(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData();
    if (mode === "file" && file) form.append("file", file);
    else if (mode === "text" && pastedText.trim()) form.append("text", pastedText.trim());
    else {
      setError("Carica un file o incolla il testo della scheda.");
      setBusy(false);
      return;
    }
    const res = await fetch("/api/coach/evaluation-criteria/import", { method: "POST", body: form });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Errore durante l'analisi.");
      return;
    }
    const flattened: ImportedCriterionRow[] = (data.categories as { name: string; criteria: { name: string; scoreType: ScoreType; targetLevel: string }[] }[]).flatMap(
      (cat) => cat.criteria.map((c) => ({ category: cat.name, name: c.name, scoreType: c.scoreType, targetLevel: c.targetLevel || "" }))
    );
    setRows(flattened);
    setStep("review");
  }

  function updateRow(i: number, patch: Partial<ImportedCriterionRow>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function removeRow(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }
  function addRow() {
    setRows((prev) => [...prev, { category: "", name: "", scoreType: "SCALE_1_10", targetLevel: "" }]);
  }

  async function save() {
    const criteria = rows.filter((r) => r.category.trim() && r.name.trim());
    if (criteria.length === 0) {
      setError("Nessun criterio da salvare.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch("/api/coach/evaluation-criteria/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ criteria: criteria.map((r) => ({ ...r, targetLevel: r.targetLevel || undefined })) }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Errore durante il salvataggio.");
      return;
    }
    trackClient("evaluation_criteria_bulk_saved", { count: criteria.length });
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full max-w-lg animate-scale-in space-y-4 overflow-y-auto rounded-xl border border-border bg-surface p-6"
      >
        {step === "upload" ? (
          <form onSubmit={analyze} className="space-y-3">
            <h2 className="text-lg font-semibold">Importa criteri da file</h2>
            <p className="text-xs text-muted">
              Carica la tua scheda di valutazione (PDF, DOCX, CSV, TXT o una foto) oppure incolla il testo. L&apos;AI riconosce SOLO la
              struttura presente nel documento — non inventa criteri.
            </p>
            <div className="flex gap-2 text-xs">
              <button
                type="button"
                onClick={() => setMode("file")}
                className={`rounded-md px-3 py-1.5 ${mode === "file" ? "bg-accent text-black" : "border border-border text-muted"}`}
              >
                Carica file
              </button>
              <button
                type="button"
                onClick={() => setMode("text")}
                className={`rounded-md px-3 py-1.5 ${mode === "text" ? "bg-accent text-black" : "border border-border text-muted"}`}
              >
                Incolla testo
              </button>
            </div>

            {mode === "file" ? (
              <input
                type="file"
                accept=".pdf,.docx,.csv,.txt,image/jpeg,image/png,image/webp"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none file:mr-3 file:rounded file:border-0 file:bg-accent file:px-2 file:py-1 file:text-xs file:font-medium file:text-black"
              />
            ) : (
              <textarea
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                rows={6}
                placeholder={"Incolla qui il testo della tua scheda, es.:\nTecnica\n- Servizio\n- Diritto\nTattica\n- Posizionamento"}
                className="w-full resize-none rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
              />
            )}

            {error && <p className="text-sm text-negative">{error}</p>}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={busy}
                className="flex-1 rounded-md bg-accent py-2 text-sm font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {busy ? "Analisi in corso…" : "Analizza con AI"}
              </button>
              <button type="button" onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-surface-2">
                Annulla
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Abbiamo trovato questa struttura</h2>
            <p className="text-xs text-muted">Controlla, modifica, elimina o aggiungi righe prima di salvare — nulla viene salvato finché non confermi.</p>

            <div className="space-y-2">
              {rows.map((row, i) => (
                <div key={i} className="flex flex-wrap items-center gap-1.5 rounded-md bg-surface-2 p-2">
                  <input
                    value={row.category}
                    onChange={(e) => updateRow(i, { category: e.target.value })}
                    placeholder="Categoria"
                    className="w-24 rounded-md border border-border bg-surface px-2 py-1 text-xs outline-none focus:border-accent"
                  />
                  <input
                    value={row.name}
                    onChange={(e) => updateRow(i, { name: e.target.value })}
                    placeholder="Criterio"
                    className="min-w-[140px] flex-1 rounded-md border border-border bg-surface px-2 py-1 text-xs outline-none focus:border-accent"
                  />
                  <select
                    value={row.scoreType}
                    onChange={(e) => updateRow(i, { scoreType: e.target.value as ScoreType })}
                    className="rounded-md border border-border bg-surface px-2 py-1 text-xs outline-none focus:border-accent"
                  >
                    {Object.entries(SCORE_TYPE_LABEL).map(([type, label]) => (
                      <option key={type} value={type}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <button type="button" onClick={() => removeRow(i)} className="text-xs text-negative">
                    Rimuovi
                  </button>
                </div>
              ))}
              {rows.length === 0 && <p className="text-sm text-muted">Nessun criterio riconosciuto. Aggiungine uno manualmente.</p>}
            </div>

            <button type="button" onClick={addRow} className="text-xs text-accent underline underline-offset-4">
              + Aggiungi riga
            </button>

            {error && <p className="text-sm text-negative">{error}</p>}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={save}
                disabled={busy}
                className="flex-1 rounded-md bg-accent py-2 text-sm font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {busy ? "Salvataggio…" : `Salva ${rows.length} criteri`}
              </button>
              <button type="button" onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-surface-2">
                Annulla
              </button>
            </div>
          </div>
        )}
      </div>
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

/**
 * A real trend chart from the athlete/team's own evaluation history — not a
 * marketing mockup. Only SCALE/PERCENTAGE/SUCCESS_RATE criteria are
 * chartable: TIME_SECONDS/DISTANCE_METERS/REPETITIONS have no fixed
 * direction or ceiling, and QUALITATIVE isn't numeric, so none of those are
 * offered rather than plotting a misleading line.
 */
const CHARTABLE_TYPES: ScoreType[] = ["SCALE_1_5", "SCALE_1_10", "PERCENTAGE", "SUCCESS_RATE"];

function EvaluationTrendChart({ criteria, evaluations }: { criteria: Criterion[]; evaluations: EvaluationItem[] }) {
  const chartableCriteria = useMemo(() => {
    return criteria.filter((c) => {
      if (!CHARTABLE_TYPES.includes(c.scoreType)) return false;
      const points = evaluations.filter((ev) => ev.scores.some((s) => s.criterionId === c.id && Number.isFinite(Number(s.value.replace(",", ".")))));
      return points.length >= 2;
    });
  }, [criteria, evaluations]);

  const [criterionId, setCriterionId] = useState<string>(chartableCriteria[0]?.id ?? "");
  const activeCriterionId = chartableCriteria.some((c) => c.id === criterionId) ? criterionId : chartableCriteria[0]?.id ?? "";
  const activeCriterion = chartableCriteria.find((c) => c.id === activeCriterionId);

  const points = useMemo(() => {
    if (!activeCriterion) return [];
    return evaluations
      .slice()
      .sort((a, b) => +new Date(a.evaluatedAt) - +new Date(b.evaluatedAt))
      .map((ev) => {
        const score = ev.scores.find((s) => s.criterionId === activeCriterion.id);
        const value = score ? Number(score.value.replace(",", ".")) : NaN;
        return { date: ev.evaluatedAt, value };
      })
      .filter((p) => Number.isFinite(p.value));
  }, [activeCriterion, evaluations]);

  if (chartableCriteria.length === 0 || points.length < 2 || !activeCriterion) return null;

  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 100;
  const h = 32;
  const coords = points.map((p, i) => {
    const x = points.length === 1 ? 0 : (i / (points.length - 1)) * w;
    const y = h - ((p.value - min) / range) * h;
    return `${x},${y}`;
  });

  const last = points[points.length - 1].value;
  const prev = points[points.length - 2].value;
  const trend = last > prev ? "up" : last < prev ? "down" : "flat";
  const suffix = SCORE_TYPE_SUFFIX[activeCriterion.scoreType];

  return (
    <div className="mb-4 rounded-lg bg-surface-2 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        {chartableCriteria.length > 1 ? (
          <select
            value={activeCriterionId}
            onChange={(e) => setCriterionId(e.target.value)}
            className="rounded-md border border-border bg-surface px-2 py-1 text-xs outline-none focus:border-accent"
          >
            {chartableCriteria.map((c) => (
              <option key={c.id} value={c.id}>
                {c.category} · {c.name}
              </option>
            ))}
          </select>
        ) : (
          <p className="text-xs font-medium text-muted">
            {activeCriterion.category} · {activeCriterion.name}
          </p>
        )}
        <span className={`text-xs font-medium ${trend === "up" ? "text-improving" : trend === "down" ? "text-negative" : "text-muted"}`}>
          {trend === "up" ? "↑" : trend === "down" ? "↓" : "→"} {last}
          {suffix}
        </span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-14 w-full text-accent">
        <polyline points={coords.join(" ")} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}
