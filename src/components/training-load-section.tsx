"use client";

import { useEffect, useMemo, useState } from "react";
import { trackClient } from "@/lib/track-client";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { computeTrainingLoad, getDisciplineCoefficient, getZoneMultiplier, TRAINING_ZONES, TRAINING_ZONE_LABEL, DISCIPLINE_SUGGESTIONS, type TrainingZone } from "@/lib/training-load";

type Entry = {
  id: string;
  date: string;
  discipline: string;
  durationMinutes: number;
  rpe: number;
  zone: TrainingZone;
  load: number;
  notes: string | null;
};

/**
 * Carico di allenamento calcolato ogni giorno dalla sessione registrata —
 * durata × sforzo percepito × disciplina × zona (vedi lib/training-load.ts).
 * Stessa collocazione e stesso pattern trend-chart della sezione Metriche,
 * ma il valore non viene digitato a mano: lo calcola l'app.
 */
export function TrainingLoadSection({ basePath }: { basePath: string }) {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [sportName, setSportName] = useState("");
  const [disciplines, setDisciplines] = useState<string[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch(`${basePath}/training-load`);
    const data = await res.json();
    if (res.ok) {
      setEntries(data.entries ?? []);
      setSportName(data.sportName ?? "");
      setDisciplines(data.disciplines ?? []);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- basePath is fixed for the component's lifetime
  }, [basePath]);

  const last7DaysTotal = useMemo(() => {
    if (!entries) return 0;
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return entries.filter((e) => +new Date(e.date) >= cutoff).reduce((sum, e) => sum + e.load, 0);
  }, [entries]);

  async function deleteEntry(id: string) {
    setDeleting(true);
    const res = await fetch(`${basePath}/training-load/${id}`, { method: "DELETE" });
    setDeleting(false);
    setDeleteTargetId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Errore durante l'eliminazione.");
      return;
    }
    trackClient("training_load_deleted", {});
    load();
  }

  if (entries === null) return null; // still loading — nothing to show yet

  return (
    <div className="mb-8 rounded-xl border border-border bg-surface p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Carico di allenamento</h2>
        <button onClick={() => setShowForm(true)} className="text-xs text-accent underline underline-offset-4">
          + Registra sessione
        </button>
      </div>

      {error && <p className="mb-2 text-xs text-negative">{error}</p>}

      {entries.length === 0 ? (
        <p className="text-sm text-muted">
          Nessuna sessione registrata ancora. Ogni volta che ne registri una, l&apos;app calcola il carico da durata, sforzo percepito, disciplina
          e zona di allenamento.
        </p>
      ) : (
        <>
          <div className="mb-3 flex items-center justify-between rounded-lg bg-surface-2 p-3">
            <p className="text-xs font-medium text-muted">Carico ultimi 7 giorni</p>
            <span className="text-sm font-semibold">{last7DaysTotal} UA</span>
          </div>

          <LoadTrendChart entries={entries} />

          <div className="mt-4 space-y-2">
            {entries.map((e) => (
              <div key={e.id} className="rounded-lg bg-surface-2 p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-muted">{new Date(e.date).toLocaleDateString("it-IT")}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{e.load} UA</span>
                    <button onClick={() => setDeleteTargetId(e.id)} className="text-xs text-muted hover:text-negative">
                      Elimina
                    </button>
                  </div>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <span className="rounded-full bg-surface px-2.5 py-1 text-xs font-medium">{e.discipline}</span>
                  <span className="rounded-full bg-surface px-2.5 py-1 text-xs">{TRAINING_ZONE_LABEL[e.zone]}</span>
                  <span className="rounded-full bg-surface px-2.5 py-1 text-xs">{e.durationMinutes} min</span>
                  <span className="rounded-full bg-surface px-2.5 py-1 text-xs">RPE {e.rpe}/10</span>
                </div>
                {e.notes && <p className="mt-2 text-foreground/80">{e.notes}</p>}
              </div>
            ))}
          </div>
        </>
      )}

      {showForm && (
        <NewTrainingLoadForm
          basePath={basePath}
          sportName={sportName}
          disciplines={disciplines}
          onClose={() => setShowForm(false)}
          onCreated={() => {
            setShowForm(false);
            load();
          }}
          onError={setError}
        />
      )}

      {deleteTargetId && (
        <ConfirmDialog
          title="Eliminare questa sessione?"
          description="L'azione non è reversibile."
          confirmLabel="Elimina"
          danger
          busy={deleting}
          onCancel={() => setDeleteTargetId(null)}
          onConfirm={() => deleteEntry(deleteTargetId)}
        />
      )}
    </div>
  );
}

/** Somma del carico per giorno, stesso pattern inline-SVG sparkline usato altrove nell'app (vedi MetricsSection/CheckinSection). */
function LoadTrendChart({ entries }: { entries: Entry[] }) {
  const byDay = useMemo(() => {
    const totals = new Map<string, number>();
    for (const e of entries) {
      const day = new Date(e.date).toISOString().slice(0, 10);
      totals.set(day, (totals.get(day) ?? 0) + e.load);
    }
    return Array.from(totals.entries())
      .map(([day, total]) => ({ day, total }))
      .sort((a, b) => a.day.localeCompare(b.day));
  }, [entries]);

  if (byDay.length < 2) return null;

  const values = byDay.map((p) => p.total);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 100;
  const h = 32;
  const coords = byDay.map((p, i) => {
    const x = byDay.length === 1 ? 0 : (i / (byDay.length - 1)) * w;
    const y = h - ((p.total - min) / range) * h;
    return `${x},${y}`;
  });

  const last = values[values.length - 1];
  const prev = values[values.length - 2];
  const trend = last > prev ? "up" : last < prev ? "down" : "flat";

  return (
    <div className="rounded-lg bg-surface-2 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted">Andamento carico giornaliero</p>
        <span className={`text-xs font-medium ${trend === "up" ? "text-improving" : trend === "down" ? "text-negative" : "text-muted"}`}>
          {trend === "up" ? "↑" : trend === "down" ? "↓" : "→"} {last} UA
        </span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-14 w-full text-accent">
        <polyline points={coords.join(" ")} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}

function NewTrainingLoadForm({
  basePath,
  sportName,
  disciplines,
  onClose,
  onCreated,
  onError,
}: {
  basePath: string;
  sportName: string;
  disciplines: string[];
  onClose: () => void;
  onCreated: () => void;
  onError: (msg: string | null) => void;
}) {
  const [discipline, setDiscipline] = useState(disciplines[0] ?? sportName);
  const [durationMinutes, setDurationMinutes] = useState("60");
  const [rpe, setRpe] = useState("5");
  const [zone, setZone] = useState<TrainingZone>("MODERATE");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Lo sport ha discipline proprie separate (es. Triathlon: Nuoto/Ciclismo/Corsa)
  // solo per gli sport multi-disciplina — altrimenti la disciplina è lo sport stesso.
  const disciplineOptions = disciplines.length > 0 ? disciplines : [sportName, ...DISCIPLINE_SUGGESTIONS];

  const durationNum = Number(durationMinutes);
  const rpeNum = Number(rpe);
  const disciplineCoefficient = getDisciplineCoefficient(discipline);
  const preview =
    Number.isFinite(durationNum) && Number.isFinite(rpeNum) && durationNum > 0
      ? computeTrainingLoad({ durationMinutes: durationNum, rpe: rpeNum, discipline, zone })
      : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!discipline.trim()) {
      setLocalError("Indica la disciplina.");
      return;
    }
    if (!Number.isFinite(durationNum) || durationNum < 1) {
      setLocalError("Indica una durata valida.");
      return;
    }
    setBusy(true);
    setLocalError(null);
    onError(null);

    const res = await fetch(`${basePath}/training-load`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        discipline: discipline.trim(),
        durationMinutes: durationNum,
        rpe: rpeNum,
        zone,
        notes: notes.trim() || undefined,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setLocalError(data.error ?? "Errore durante il salvataggio.");
      return;
    }
    trackClient("training_load_recorded", {});
    onCreated();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full max-w-md animate-scale-in space-y-4 overflow-y-auto rounded-xl border border-border bg-surface p-6"
      >
        <h2 className="text-lg font-semibold">Registra sessione</h2>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted">Disciplina</label>
          <input
            list="training-load-disciplines"
            value={discipline}
            onChange={(e) => setDiscipline(e.target.value)}
            className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <datalist id="training-load-disciplines">
            {disciplineOptions.map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>
          <p className="mt-1 text-[11px] text-muted">Coefficiente disciplina: {disciplineCoefficient}×</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">Durata (minuti)</label>
            <input
              type="number"
              min={1}
              max={1440}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
              className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">Sforzo percepito</label>
            <input
              type="number"
              min={0}
              max={10}
              value={rpe}
              onChange={(e) => setRpe(e.target.value)}
              className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <p className="mt-1 text-[11px] text-muted">0 = nessuno sforzo, 10 = massimale</p>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted">Zona di allenamento</label>
          <select
            value={zone}
            onChange={(e) => setZone(e.target.value as TrainingZone)}
            className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
          >
            {TRAINING_ZONES.map((z) => (
              <option key={z} value={z}>
                {TRAINING_ZONE_LABEL[z]} ({getZoneMultiplier(z)}×)
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted">Note (opzionale)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full resize-none rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>

        {preview != null && (
          <div className="rounded-md bg-surface-2 p-3 text-center">
            <p className="text-xs text-muted">Carico stimato</p>
            <p className="text-lg font-semibold">{preview} UA</p>
          </div>
        )}

        {localError && <p className="text-sm text-negative">{localError}</p>}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={busy}
            className="flex-1 rounded-md bg-accent py-2 text-sm font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Salvataggio…" : "Salva"}
          </button>
          <button type="button" onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-surface-2">
            Annulla
          </button>
        </div>
      </form>
    </div>
  );
}
