"use client";

import { useEffect, useState } from "react";
import { trackClient } from "@/lib/track-client";
import { ConfirmDialog } from "@/components/confirm-dialog";

const CATEGORY_LABEL: Record<string, string> = {
  TECHNICAL: "Tecnica",
  TACTICAL: "Tattica",
  PHYSICAL: "Fisico",
  COGNITIVE: "Cognitivo",
  WARMUP: "Riscaldamento",
  COOLDOWN: "Defaticamento",
  COMPETITIVE: "Competitivo",
};
const FORMAT_LABEL: Record<string, string> = {
  INDIVIDUAL: "Individuale",
  PAIR: "Coppia",
  SMALL_GROUP: "Piccolo gruppo",
  TEAM: "Squadra",
  GAME: "Situazione di gioco",
};
const DIFFICULTY_LABEL: Record<string, string> = {
  BEGINNER: "Principiante",
  INTERMEDIATE: "Intermedio",
  ADVANCED: "Avanzato",
  ELITE: "Elite",
};

type ExerciseListItem = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  format: string | null;
  difficulty: string | null;
  durationMinutes: number | null;
  equipment: string | null;
  tags: string[];
  source: "COACH_CREATED" | "AI_GENERATED";
  skills: string[];
};

type ExerciseFormState = {
  name: string;
  description: string;
  category: string;
  format: string;
  difficulty: string;
  durationMinutes: string;
  equipment: string;
  coachingPoints: string;
  tags: string;
  skillIds: string[];
};

const EMPTY_FORM: ExerciseFormState = {
  name: "",
  description: "",
  category: "TECHNICAL",
  format: "",
  difficulty: "",
  durationMinutes: "",
  equipment: "",
  coachingPoints: "",
  tags: "",
  skillIds: [],
};

export function ExercisesClient() {
  const [exercises, setExercises] = useState<ExerciseListItem[] | null>(null);
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function load(q?: string) {
    const res = await fetch(`/api/exercises${q ? `?q=${encodeURIComponent(q)}` : ""}`);
    const data = await res.json();
    setExercises(data.exercises ?? []);
  }

  async function deleteExercise(id: string) {
    setDeleting(true);
    const res = await fetch(`/api/exercises/${id}`, { method: "DELETE" });
    setDeleting(false);
    if (res.ok) {
      setExercises((prev) => (prev ?? []).filter((ex) => ex.id !== id));
      trackClient("exercise_deleted");
    }
    setDeleteTargetId(null);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">La tua libreria esercizi</h1>
        <button
          onClick={() => setShowForm(true)}
          className="shrink-0 rounded-md bg-accent px-4 py-2 text-sm font-medium text-black transition-opacity hover:opacity-90"
        >
          + Nuovo esercizio
        </button>
      </div>

      <div className="mb-4 flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load(query)}
          placeholder="Cerca per nome…"
          className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <button onClick={() => load(query)} className="rounded-md border border-border px-3 py-2 text-sm hover:bg-surface-2">
          Cerca
        </button>
      </div>

      {exercises === null ? (
        <div className="flex justify-center py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-accent" />
        </div>
      ) : exercises.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <p className="text-sm text-muted">Nessun esercizio ancora nella tua libreria.</p>
          <button onClick={() => setShowForm(true)} className="mt-3 text-sm text-accent underline underline-offset-4">
            Crea il primo
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {exercises.map((ex) => (
            <div key={ex.id} className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-medium">{ex.name}</h3>
                <div className="flex shrink-0 items-center gap-2">
                  {ex.source === "AI_GENERATED" && (
                    <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] text-muted">generato da AI</span>
                  )}
                  <button onClick={() => setDeleteTargetId(ex.id)} className="text-[11px] text-muted transition-colors hover:text-negative">
                    Elimina
                  </button>
                </div>
              </div>
              {ex.description && <p className="mt-1 text-sm text-muted">{ex.description}</p>}
              <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                <span className="rounded-full bg-accent/15 px-2 py-0.5 text-accent">{CATEGORY_LABEL[ex.category] ?? ex.category}</span>
                {ex.format && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-muted">{FORMAT_LABEL[ex.format]}</span>}
                {ex.difficulty && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-muted">{DIFFICULTY_LABEL[ex.difficulty]}</span>}
                {ex.durationMinutes && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-muted">{ex.durationMinutes} min</span>}
                {ex.skills.map((s, i) => (
                  <span key={i} className="rounded-full bg-surface-2 px-2 py-0.5 text-muted">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <NewExerciseModal
          onClose={() => setShowForm(false)}
          onCreated={() => {
            setShowForm(false);
            load(query);
          }}
        />
      )}

      {deleteTargetId && (
        <ConfirmDialog
          title="Eliminare questo esercizio?"
          description="Verrà rimosso dalla libreria. L'azione non è reversibile."
          confirmLabel="Elimina"
          danger
          busy={deleting}
          onCancel={() => setDeleteTargetId(null)}
          onConfirm={() => deleteExercise(deleteTargetId)}
        />
      )}
    </div>
  );
}

function NewExerciseModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [mode, setMode] = useState<"quick" | "manual">("quick");
  const [quickText, setQuickText] = useState("");
  const [quickBusy, setQuickBusy] = useState(false);
  const [availableSkills, setAvailableSkills] = useState<{ id: string; name: string; category: string }[]>([]);
  const [form, setForm] = useState<ExerciseFormState>(EMPTY_FORM);
  const [reviewing, setReviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runQuickCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!quickText.trim()) return;
    setQuickBusy(true);
    setError(null);
    const res = await fetch("/api/exercises/quick", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: quickText }),
    });
    const data = await res.json();
    setQuickBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Errore durante l'analisi AI.");
      return;
    }
    setAvailableSkills(data.skills ?? []);
    setForm({
      name: data.draft.name ?? "",
      description: data.draft.description ?? "",
      category: data.draft.category ?? "TECHNICAL",
      format: data.draft.format ?? "",
      difficulty: data.draft.difficulty ?? "",
      durationMinutes: data.draft.durationMinutes ? String(data.draft.durationMinutes) : "",
      equipment: data.draft.equipment ?? "",
      coachingPoints: data.draft.coachingPoints ?? "",
      tags: (data.draft.tags ?? []).join(", "),
      skillIds: data.draft.skillIds ?? [],
    });
    trackClient("exercise_quick_created");
    setReviewing(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch("/api/exercises", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        description: form.description || undefined,
        category: form.category,
        format: form.format || undefined,
        difficulty: form.difficulty || undefined,
        durationMinutes: form.durationMinutes ? Number(form.durationMinutes) : undefined,
        equipment: form.equipment || undefined,
        coachingPoints: form.coachingPoints || undefined,
        tags: form.tags
          ? form.tags
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean)
          : [],
        skillIds: form.skillIds,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Errore durante il salvataggio.");
      return;
    }
    trackClient("exercise_created");
    onCreated();
  }

  const showManualForm = mode === "manual" || reviewing;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-lg animate-scale-in overflow-y-auto rounded-xl border border-border bg-surface p-6"
      >
        <h2 className="mb-4 text-lg font-semibold">Nuovo esercizio</h2>

        {!showManualForm && (
          <>
            <div className="mb-4 flex gap-2 text-sm">
              <button onClick={() => setMode("quick")} className="rounded-md bg-accent/15 px-3 py-1.5 text-accent">
                Quick Create (AI)
              </button>
              <button onClick={() => setMode("manual")} className="rounded-md border border-border px-3 py-1.5 text-muted hover:bg-surface-2">
                Compila a mano
              </button>
            </div>
            <form onSubmit={runQuickCreate} className="space-y-3">
              <label className="block text-xs font-medium text-muted">Descrivi l&apos;esercizio in una frase</label>
              <textarea
                autoFocus
                value={quickText}
                onChange={(e) => setQuickText(e.target.value)}
                rows={3}
                placeholder='Es. "2v2 dove la coppia può segnare solo dopo aver creato un lob"'
                className="w-full resize-none rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
              />
              {error && <p className="text-sm text-negative">{error}</p>}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={quickBusy || !quickText.trim()}
                  className="flex-1 rounded-md bg-accent py-2 text-sm font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {quickBusy ? "Analisi AI in corso…" : "Genera scheda"}
                </button>
                <button type="button" onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-surface-2">
                  Annulla
                </button>
              </div>
            </form>
          </>
        )}

        {showManualForm && (
          <form onSubmit={save} className="space-y-3">
            {reviewing && (
              <p className="rounded-md bg-improving/10 px-3 py-2 text-xs text-improving">
                Bozza generata dall&apos;AI — controlla e modifica prima di salvare.
              </p>
            )}
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Nome</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Descrizione</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
                className="w-full resize-none rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">Categoria</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
                >
                  {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">Formato</label>
                <select
                  value={form.format}
                  onChange={(e) => setForm({ ...form, format: e.target.value })}
                  className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
                >
                  <option value="">—</option>
                  {Object.entries(FORMAT_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">Difficoltà</label>
                <select
                  value={form.difficulty}
                  onChange={(e) => setForm({ ...form, difficulty: e.target.value })}
                  className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
                >
                  <option value="">—</option>
                  {Object.entries(DIFFICULTY_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">Durata (min)</label>
                <input
                  type="number"
                  min={1}
                  value={form.durationMinutes}
                  onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })}
                  className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Attrezzatura</label>
              <input
                value={form.equipment}
                onChange={(e) => setForm({ ...form, equipment: e.target.value })}
                className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Punti chiave</label>
              <textarea
                value={form.coachingPoints}
                onChange={(e) => setForm({ ...form, coachingPoints: e.target.value })}
                rows={2}
                className="w-full resize-none rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </div>
            {availableSkills.length > 0 && (
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">Competenze collegate</label>
                <div className="flex flex-wrap gap-1.5">
                  {availableSkills.map((s) => {
                    const active = form.skillIds.includes(s.id);
                    return (
                      <button
                        type="button"
                        key={s.id}
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            skillIds: active ? f.skillIds.filter((id) => id !== s.id) : [...f.skillIds, s.id],
                          }))
                        }
                        className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
                          active ? "bg-accent text-black" : "bg-surface-2 text-muted hover:text-foreground"
                        }`}
                      >
                        {s.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Tag (separati da virgola)</label>
              <input
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </div>

            {error && <p className="text-sm text-negative">{error}</p>}

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={saving || !form.name.trim()}
                className="flex-1 rounded-md bg-accent py-2 text-sm font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {saving ? "Salvataggio…" : "Salva esercizio"}
              </button>
              <button type="button" onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-surface-2">
                Annulla
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
