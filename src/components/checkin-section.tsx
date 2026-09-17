"use client";

import { useEffect, useMemo, useState } from "react";
import { trackClient } from "@/lib/track-client";
import { CHECKIN_CSV_TEMPLATE_HEADER } from "@/lib/checkin-import";

type Feeling = "GREAT" | "GOOD" | "OK" | "TIRED" | "UNWELL";
type CheckinSource = "SELF_REPORTED" | "WEARABLE_IMPORT";

type Checkin = {
  id: string;
  date: string;
  readiness: number | null;
  rpe: number | null;
  feeling: Feeling | null;
  sleepHours: number | null;
  soreness: number | null;
  restingHeartRate: number | null;
  hrv: number | null;
  steps: number | null;
  notes: string | null;
  source: CheckinSource;
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
  const [showImport, setShowImport] = useState(false);
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
        <div className="flex gap-3">
          <button onClick={() => setShowImport(true)} className="text-xs text-accent underline underline-offset-4">
            Importa da wearable
          </button>
          <button onClick={() => setShowForm(true)} className="text-xs text-accent underline underline-offset-4">
            + Nuovo check-in
          </button>
        </div>
      </div>

      {error && <p className="mb-2 text-xs text-negative">{error}</p>}

      {checkins && checkins.length > 1 && <ReadinessTrendChart checkins={checkins} />}

      {checkins === null ? (
        <p className="text-sm text-muted">Caricamento…</p>
      ) : checkins.length === 0 ? (
        <p className="text-sm text-muted">
          Nessun check-in registrato ancora. Traccia prontezza, sforzo percepito e sonno prima/dopo l&apos;allenamento, oppure importa dati dal
          tuo wearable.
        </p>
      ) : (
        <div className="space-y-2">
          {checkins.map((c) => (
            <div key={c.id} className="rounded-lg bg-surface-2 p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted">{new Date(c.date).toLocaleDateString("it-IT")}</p>
                {c.source === "WEARABLE_IMPORT" && (
                  <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-medium text-accent">wearable</span>
                )}
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {c.readiness != null && <span className="rounded-full bg-surface px-2.5 py-1 text-xs">Prontezza {c.readiness}/10</span>}
                {c.rpe != null && <span className="rounded-full bg-surface px-2.5 py-1 text-xs">Sforzo percepito {c.rpe}/10</span>}
                {c.feeling && <span className="rounded-full bg-surface px-2.5 py-1 text-xs">{FEELING_LABEL[c.feeling]}</span>}
                {c.sleepHours != null && <span className="rounded-full bg-surface px-2.5 py-1 text-xs">Sonno {c.sleepHours}h</span>}
                {c.soreness != null && <span className="rounded-full bg-surface px-2.5 py-1 text-xs">Indolenzimento {c.soreness}/10</span>}
                {c.restingHeartRate != null && <span className="rounded-full bg-surface px-2.5 py-1 text-xs">FC riposo {c.restingHeartRate} bpm</span>}
                {c.hrv != null && <span className="rounded-full bg-surface px-2.5 py-1 text-xs">HRV {c.hrv}</span>}
                {c.steps != null && <span className="rounded-full bg-surface px-2.5 py-1 text-xs">{c.steps} passi</span>}
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

      {showImport && (
        <ImportWearableModal
          basePath={basePath}
          onClose={() => setShowImport(false)}
          onImported={() => {
            setShowImport(false);
            load();
          }}
        />
      )}
    </div>
  );
}

/** Simple sparkline of readiness over time — reuses the app's established inline-SVG trend-chart pattern (see EvaluationsSection). */
function ReadinessTrendChart({ checkins }: { checkins: Checkin[] }) {
  const points = useMemo(
    () =>
      checkins
        .filter((c) => c.readiness != null)
        .slice()
        .sort((a, b) => +new Date(a.date) - +new Date(b.date)),
    [checkins]
  );

  if (points.length < 2) return null;

  const values = points.map((p) => p.readiness as number);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 100;
  const h = 32;
  const coords = points.map((p, i) => {
    const x = points.length === 1 ? 0 : (i / (points.length - 1)) * w;
    const y = h - (((p.readiness as number) - min) / range) * h;
    return `${x},${y}`;
  });

  const last = values[values.length - 1];
  const prev = values[values.length - 2];
  const trend = last > prev ? "up" : last < prev ? "down" : "flat";

  return (
    <div className="mb-4 rounded-lg bg-surface-2 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted">Tendenza prontezza</p>
        <span className={`text-xs font-medium ${trend === "up" ? "text-improving" : trend === "down" ? "text-negative" : "text-muted"}`}>
          {trend === "up" ? "↑" : trend === "down" ? "↓" : "→"} {last}/10
        </span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-14 w-full text-accent">
        <polyline points={coords.join(" ")} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}

function ImportWearableModal({ basePath, onClose, onImported }: { basePath: string; onClose: () => void; onImported: () => void }) {
  const [mode, setMode] = useState<"file" | "text">("file");
  const [file, setFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ imported: number; skipped: string[] } | null>(null);

  async function importData(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);

    const form = new FormData();
    if (mode === "file" && file) form.append("file", file);
    else if (mode === "text" && pastedText.trim()) form.append("text", pastedText.trim());
    else {
      setError("Carica un file CSV o incolla il contenuto.");
      setBusy(false);
      return;
    }

    const res = await fetch(`${basePath}/checkins/import`, { method: "POST", body: form });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Errore durante l'importazione.");
      return;
    }
    setResult({ imported: data.imported, skipped: data.skipped ?? [] });
    trackClient("checkin_created", { imported: data.imported });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full max-w-lg animate-scale-in space-y-4 overflow-y-auto rounded-xl border border-border bg-surface p-6"
      >
        {result ? (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Importazione completata</h2>
            <p className="text-sm text-foreground/90">{result.imported} check-in importati.</p>
            {result.skipped.length > 0 && (
              <div className="rounded-md bg-surface-2 p-3 text-xs text-muted">
                <p className="mb-1 font-medium text-foreground/70">{result.skipped.length} righe ignorate:</p>
                <ul className="list-disc space-y-0.5 pl-4">
                  {result.skipped.slice(0, 10).map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
            <button onClick={onImported} className="w-full rounded-md bg-accent py-2 text-sm font-medium text-black transition-opacity hover:opacity-90">
              Chiudi
            </button>
          </div>
        ) : (
          <form onSubmit={importData} className="space-y-3">
            <h2 className="text-lg font-semibold">Importa dati da wearable</h2>
            <p className="text-xs text-muted">
              Nessun dispositivo si collega direttamente ancora — esporta i dati dalla tua app (Garmin Connect, Apple Salute, Whoop, ecc.) in un
              foglio con queste colonne (solo &quot;date&quot; è obbligatoria) e caricalo qui:
            </p>
            <code className="block overflow-x-auto rounded-md bg-surface-2 p-2 text-[11px] text-muted">{CHECKIN_CSV_TEMPLATE_HEADER}</code>

            <div className="flex gap-2 text-xs">
              <button
                type="button"
                onClick={() => setMode("file")}
                className={`rounded-md px-3 py-1.5 ${mode === "file" ? "bg-accent text-black" : "border border-border text-muted"}`}
              >
                Carica file CSV
              </button>
              <button
                type="button"
                onClick={() => setMode("text")}
                className={`rounded-md px-3 py-1.5 ${mode === "text" ? "bg-accent text-black" : "border border-border text-muted"}`}
              >
                Incolla contenuto
              </button>
            </div>

            {mode === "file" ? (
              <input
                type="file"
                accept=".csv,text/csv,text/plain"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none file:mr-3 file:rounded file:border-0 file:bg-accent file:px-2 file:py-1 file:text-xs file:font-medium file:text-black"
              />
            ) : (
              <textarea
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                rows={6}
                placeholder={CHECKIN_CSV_TEMPLATE_HEADER}
                className="w-full resize-none rounded-md border border-border bg-surface-2 px-3 py-2 font-mono text-xs outline-none focus:border-accent"
              />
            )}

            {error && <p className="text-sm text-negative">{error}</p>}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={busy}
                className="flex-1 rounded-md bg-accent py-2 text-sm font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {busy ? "Importazione…" : "Importa"}
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
            <label className="mb-1.5 block text-xs font-medium text-muted">Prontezza</label>
            <input
              type="number"
              min={1}
              max={10}
              value={readiness}
              onChange={(e) => setReadiness(e.target.value)}
              className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <p className="mt-1 text-[11px] text-muted">1 = per niente pronto, 10 = al top della forma</p>
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
            <p className="mt-1 text-[11px] text-muted">0 = nessuno sforzo, 10 = sforzo massimale</p>
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
            <label className="mb-1.5 block text-xs font-medium text-muted">Indolenzimento</label>
            <input
              type="number"
              min={1}
              max={10}
              value={soreness}
              onChange={(e) => setSoreness(e.target.value)}
              className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <p className="mt-1 text-[11px] text-muted">1 = nessun indolenzimento, 10 = molto indolenzito</p>
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
