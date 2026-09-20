"use client";

import { useState } from "react";
import { trackClient } from "@/lib/track-client";
import { ConfirmDialog } from "@/components/confirm-dialog";

export type GoalData = {
  id: string;
  title: string;
  description: string | null;
  termLength: "SHORT" | "MEDIUM" | "LONG";
  kind: "QUANTITATIVE" | "QUALITATIVE";
  baselineValue: string | null;
  targetValue: string | null;
  currentValue: string | null;
  unit: string | null;
  deadline: string | null;
  status: "ACTIVE" | "ACHIEVED" | "ABANDONED";
};

const TERM_LABEL: Record<GoalData["termLength"], string> = {
  SHORT: "Breve termine",
  MEDIUM: "Medio termine",
  LONG: "Lungo termine",
};

const STATUS_LABEL: Record<GoalData["status"], string> = {
  ACTIVE: "Attivo",
  ACHIEVED: "Raggiunto",
  ABANDONED: "Abbandonato",
};

const STATUS_STYLE: Record<GoalData["status"], string> = {
  ACTIVE: "bg-accent/15 text-accent",
  ACHIEVED: "bg-positive/15 text-positive",
  ABANDONED: "bg-surface-2 text-muted",
};

function parseNum(v: string | null): number | null {
  if (!v) return null;
  const n = Number(v.replace(",", ".").replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function progressPercent(g: GoalData): number | null {
  const base = parseNum(g.baselineValue);
  const target = parseNum(g.targetValue);
  const current = parseNum(g.currentValue);
  if (base === null || target === null || current === null || target === base) return null;
  const pct = ((current - base) / (target - base)) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

/**
 * Shared "Obiettivi" section for both an athlete and a team page — same
 * shape (Objective can belong to either), so one component parameterized by
 * the owning resource's API base path avoids duplicating the whole flow.
 */
export function ObjectivesSection({ basePath, initialGoals }: { basePath: string; initialGoals: GoalData[] }) {
  const [goals, setGoals] = useState(initialGoals);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function updateGoal(id: string, data: { currentValue?: string; status?: GoalData["status"] }) {
    setError(null);
    const res = await fetch(`${basePath}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) {
      setError(result.error ?? "Errore durante l'aggiornamento.");
      return;
    }
    setGoals((prev) => prev.map((g) => (g.id === id ? result.objective : g)));
    trackClient("objective_updated", { objectiveId: id });
  }

  async function deleteGoal(id: string) {
    setDeleting(true);
    setError(null);
    const res = await fetch(`${basePath}/${id}`, { method: "DELETE" });
    setDeleting(false);
    setDeleteTargetId(null);
    if (!res.ok) {
      const result = await res.json().catch(() => ({}));
      setError(result.error ?? "Errore durante l'eliminazione.");
      return;
    }
    setGoals((prev) => prev.filter((g) => g.id !== id));
    trackClient("objective_deleted", { objectiveId: id });
  }

  return (
    <div className="mb-8 rounded-xl border border-border bg-surface p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Obiettivi</h2>
        <button onClick={() => setShowForm(true)} className="text-xs text-accent underline underline-offset-4">
          + Nuovo obiettivo
        </button>
      </div>

      {error && <p className="mb-2 text-xs text-negative">{error}</p>}

      {goals.length === 0 ? (
        <p className="text-sm text-muted">Nessun obiettivo definito ancora.</p>
      ) : (
        <div className="space-y-3">
          {goals.map((g) => {
            const pct = progressPercent(g);
            return (
              <div key={g.id} className="rounded-lg bg-surface-2 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{g.title}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {TERM_LABEL[g.termLength]}
                      {g.deadline ? ` · scadenza ${new Date(g.deadline).toLocaleDateString("it-IT")}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLE[g.status]}`}>
                      {STATUS_LABEL[g.status]}
                    </span>
                    <button
                      onClick={() => setDeleteTargetId(g.id)}
                      className="text-[11px] text-muted transition-colors hover:text-negative"
                      aria-label="Elimina obiettivo"
                    >
                      Elimina
                    </button>
                  </div>
                </div>

                {g.description && <p className="mt-2 text-xs text-foreground/80">{g.description}</p>}

                {g.kind === "QUANTITATIVE" ? (
                  <div className="mt-2">
                    <p className="text-xs text-muted">
                      Baseline: {g.baselineValue ?? "—"}
                      {g.unit} → Attuale: {g.currentValue ?? "—"}
                      {g.unit} → Target: {g.targetValue ?? "—"}
                      {g.unit}
                    </p>
                    {pct !== null && (
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-border">
                        <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                      </div>
                    )}
                  </div>
                ) : (
                  g.currentValue && <p className="mt-2 text-xs text-muted">Stato attuale: {g.currentValue}</p>
                )}

                {g.status === "ACTIVE" && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <UpdateCurrentValue goalId={g.id} onSave={(v) => updateGoal(g.id, { currentValue: v })} />
                    <button
                      onClick={() => updateGoal(g.id, { status: "ACHIEVED" })}
                      className="rounded-md border border-border px-2 py-1 text-[11px] transition-colors hover:bg-surface"
                    >
                      Segna raggiunto
                    </button>
                    <button
                      onClick={() => updateGoal(g.id, { status: "ABANDONED" })}
                      className="rounded-md border border-border px-2 py-1 text-[11px] text-muted transition-colors hover:bg-surface"
                    >
                      Abbandona
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <NewObjectiveForm
          basePath={basePath}
          onClose={() => setShowForm(false)}
          onCreated={(g) => {
            setGoals((prev) => [g, ...prev]);
            setShowForm(false);
          }}
        />
      )}

      {deleteTargetId && (
        <ConfirmDialog
          title="Eliminare questo obiettivo?"
          description="L'azione non è reversibile."
          confirmLabel="Elimina"
          danger
          busy={deleting}
          onCancel={() => setDeleteTargetId(null)}
          onConfirm={() => deleteGoal(deleteTargetId)}
        />
      )}
    </div>
  );
}

function UpdateCurrentValue({ goalId, onSave }: { goalId: string; onSave: (value: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="rounded-md border border-border px-2 py-1 text-[11px] transition-colors hover:bg-surface"
      >
        Aggiorna valore
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(value);
        setEditing(false);
        setValue("");
      }}
      className="flex items-center gap-1"
      data-goal-id={goalId}
    >
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Nuovo valore"
        className="w-24 rounded-md border border-border bg-surface px-2 py-1 text-[11px] outline-none focus:border-accent"
      />
      <button type="submit" className="rounded-md bg-accent px-2 py-1 text-[11px] font-medium text-black">
        Salva
      </button>
    </form>
  );
}

function NewObjectiveForm({
  basePath,
  onClose,
  onCreated,
}: {
  basePath: string;
  onClose: () => void;
  onCreated: (goal: GoalData) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [termLength, setTermLength] = useState<GoalData["termLength"]>("MEDIUM");
  const [kind, setKind] = useState<GoalData["kind"]>("QUALITATIVE");
  const [baselineValue, setBaselineValue] = useState("");
  const [targetValue, setTargetValue] = useState("");
  const [unit, setUnit] = useState("");
  const [deadline, setDeadline] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch(basePath, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description: description || undefined,
        termLength,
        kind,
        baselineValue: kind === "QUANTITATIVE" ? baselineValue || undefined : undefined,
        targetValue: kind === "QUANTITATIVE" ? targetValue || undefined : undefined,
        unit: kind === "QUANTITATIVE" ? unit || undefined : undefined,
        deadline: deadline ? new Date(deadline).toISOString() : undefined,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Errore durante la creazione.");
      return;
    }
    trackClient("objective_created", {});
    onCreated(data.objective);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm animate-scale-in space-y-3 rounded-xl border border-border bg-surface p-6"
      >
        <h2 className="text-lg font-semibold">Nuovo obiettivo</h2>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted">Titolo</label>
          <input
            required
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
            placeholder="Es. Migliorare la transizione difensiva"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted">Descrizione (opzionale)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full resize-none rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="mb-1.5 block text-xs font-medium text-muted">Orizzonte</label>
            <select
              value={termLength}
              onChange={(e) => setTermLength(e.target.value as GoalData["termLength"])}
              className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
            >
              <option value="SHORT">Breve termine</option>
              <option value="MEDIUM">Medio termine</option>
              <option value="LONG">Lungo termine</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="mb-1.5 block text-xs font-medium text-muted">Tipo</label>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as GoalData["kind"])}
              className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
            >
              <option value="QUALITATIVE">Qualitativo</option>
              <option value="QUANTITATIVE">Quantitativo</option>
            </select>
          </div>
        </div>

        {kind === "QUANTITATIVE" && (
          <div className="flex gap-2">
            <input
              value={baselineValue}
              onChange={(e) => setBaselineValue(e.target.value)}
              placeholder="Baseline"
              className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <input
              value={targetValue}
              onChange={(e) => setTargetValue(e.target.value)}
              placeholder="Target"
              className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="Unità (%, /10…)"
              className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted">Scadenza (opzionale)</label>
          <input
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>

        {error && <p className="text-sm text-negative">{error}</p>}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={busy}
            className="flex-1 rounded-md bg-accent py-2 text-sm font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Creazione…" : "Crea obiettivo"}
          </button>
          <button type="button" onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-surface-2">
            Annulla
          </button>
        </div>
      </form>
    </div>
  );
}
