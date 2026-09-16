"use client";

import { useEffect, useState } from "react";
import { trackClient } from "@/lib/track-client";

type Feeling = "GREAT" | "GOOD" | "OK" | "TIRED" | "UNWELL";

type Checkin = {
  id: string;
  date: string;
  readiness: number | null;
  rpe: number | null;
  feeling: Feeling | null;
  sleepHours: number | null;
  soreness: number | null;
  notes: string | null;
};

const FEELING_LABEL: Record<Feeling, string> = {
  GREAT: "Al top",
  GOOD: "Bene",
  OK: "Nella norma",
  TIRED: "Stanco",
  UNWELL: "Non al meglio",
};

/**
 * Quick self-assessment log (readiness, RPE, sonno, indolenzimento) — the
 * "self check-in" ask for Self-Coach Mode. Reuses the athlete data model:
 * whoever fills it in (a self-coaching athlete, or a coach logging it for
 * someone else) is irrelevant to the schema, so this section is offered on
 * every athlete rather than gated behind isSelf.
 */
export function CheckinSection({ basePath }: { basePath: string }) {
  const [checkins, setCheckins] = useState<Checkin[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch(`${basePath}/checkins`);
    const data = await res.json();
    if (res.ok) setCheckins(data.checkins ?? []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- basePath is fixed for the component's lifetime
  }, [basePath]);

  return (
    <div className="mb-8 rounded-xl border border-border bg-surface p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Check-in</h2>
        <button onClick={() => setShowForm(true)} className="text-xs text-accent underline underline-offset-4">
          + Nuovo check-in
        </button>
      </div>

      {error && <p className="mb-2 text-xs text-negative">{error}</p>}

      {checkins === null ? (
        <p className="text-sm text-muted">Caricamento…</p>
      ) : checkins.length === 0 ? (
        <p className="text-sm text-muted">Nessun check-in registrato ancora. Traccia prontezza, sforzo percepito e sonno prima/dopo l&apos;allenamento.</p>
      ) : (
        <div className="space-y-2">
          {checkins.map((c) => (
            <div key={c.id} className="rounded-lg bg-surface-2 p-3 text-sm">
              <p className="text-xs text-muted">{new Date(c.date).toLocaleDateString("it-IT")}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {c.readiness != null && <span className="rounded-full bg-surface px-2.5 py-1 text-xs">Prontezza {c.readiness}/10</span>}
                {c.rpe != null && <span className="rounded-full bg-surface px-2.5 py-1 text-xs">Sforzo percepito {c.rpe}/10</span>}
                {c.feeling && <span className="rounded-full bg-surface px-2.5 py-1 text-xs">{FEELING_LABEL[c.feeling]}</span>}
                {c.sleepHours != null && <span className="rounded-full bg-surface px-2.5 py-1 text-xs">Sonno {c.sleepHours}h</span>}
                {c.soreness != null && <span className="rounded-full bg-surface px-2.5 py-1 text-xs">Indolenzimento {c.soreness}/10</span>}
              </div>
              {c.notes && <p className="mt-2 text-foreground/80">{c.notes}</p>}
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <NewCheckinForm
          basePath={basePath}
          onClose={() => setShowForm(false)}
          onCreated={() => {
            setShowForm(false);
            load();
          }}
          onError={setError}
        />
      )}
    </div>
  );
}

function NewCheckinForm({
  basePath,
  onClose,
  onCreated,
  onError,
}: {
  basePath: string;
  onClose: () => void;
  onCreated: () => void;
  onError: (msg: string | null) => void;
}) {
  const [readiness, setReadiness] = useState("");
  const [rpe, setRpe] = useState("");
  const [feeling, setFeeling] = useState<Feeling | "">("");
  const [sleepHours, setSleepHours] = useState("");
  const [soreness, setSoreness] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setLocalError(null);
    onError(null);

    const res = await fetch(`${basePath}/checkins`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        readiness: readiness ? Number(readiness) : undefined,
        rpe: rpe ? Number(rpe) : undefined,
        feeling: feeling || undefined,
        sleepHours: sleepHours ? Number(sleepHours) : undefined,
        soreness: soreness ? Number(soreness) : undefined,
        notes: notes.trim() || undefined,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setLocalError(data.error ?? "Errore durante il salvataggio.");
      return;
    }
    trackClient("checkin_created", {});
    onCreated();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full max-w-md animate-scale-in space-y-4 overflow-y-auto rounded-xl border border-border bg-surface p-6"
      >
        <h2 className="text-lg font-semibold">Nuovo check-in</h2>
        <p className="text-xs text-muted">Compila solo quello che ha senso ora — es. prontezza prima dell&apos;allenamento, sforzo percepito dopo.</p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">Prontezza (1-10)</label>
            <input
              type="number"
              min={1}
              max={10}
              value={readiness}
              onChange={(e) => setReadiness(e.target.value)}
              className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">Sforzo percepito (0-10)</label>
            <input
              type="number"
              min={0}
              max={10}
              value={rpe}
              onChange={(e) => setRpe(e.target.value)}
              className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">Ore di sonno</label>
            <input
              type="number"
              min={0}
              max={24}
              step={0.5}
              value={sleepHours}
              onChange={(e) => setSleepHours(e.target.value)}
              className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">Indolenzimento (1-10)</label>
            <input
              type="number"
              min={1}
              max={10}
              value={soreness}
              onChange={(e) => setSoreness(e.target.value)}
              className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted">Come ti senti</label>
          <select
            value={feeling}
            onChange={(e) => setFeeling(e.target.value as Feeling | "")}
            className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
          >
            <option value="">—</option>
            {(Object.keys(FEELING_LABEL) as Feeling[]).map((f) => (
              <option key={f} value={f}>
                {FEELING_LABEL[f]}
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

        {localError && <p className="text-sm text-negative">{localError}</p>}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={busy}
            className="flex-1 rounded-md bg-accent py-2 text-sm font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Salvataggio…" : "Salva check-in"}
          </button>
          <button type="button" onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-surface-2">
            Annulla
          </button>
        </div>
      </form>
    </div>
  );
}
