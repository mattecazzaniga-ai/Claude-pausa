"use client";

import { useEffect, useMemo, useState } from "react";
import { trackClient } from "@/lib/track-client";

type SportMetric = { id: string; name: string; unit: string | null; description: string | null };
type MetricValue = { id: string; sportMetricId: string; value: number; recordedAt: string; notes: string | null };

/**
 * Closes the loop on the Smart Metrics Engine (Phase 1 only generated the
 * metric *definitions* — this is where a coach actually records real values
 * over time). Same "Valutazioni" trend-chart pattern already used elsewhere
 * in the app, applied to sport-specific metrics instead of scored criteria.
 */
export function MetricsSection({ basePath }: { basePath: string }) {
  const [metrics, setMetrics] = useState<SportMetric[] | null>(null);
  const [values, setValues] = useState<MetricValue[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch(`${basePath}/metrics`);
    const data = await res.json();
    if (res.ok) {
      setMetrics(data.metrics ?? []);
      setValues(data.values ?? []);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- basePath is fixed for the component's lifetime
  }, [basePath]);

  const metricsWithHistory = useMemo(() => {
    if (!metrics) return [];
    return metrics
      .map((m) => ({ metric: m, points: values.filter((v) => v.sportMetricId === m.id) }))
      .filter((m) => m.points.length > 0);
  }, [metrics, values]);

  if (metrics !== null && metrics.length === 0) return null; // sport metrics not generated yet (no AI configured) — nothing to show

  return (
    <div className="mb-8 rounded-xl border border-border bg-surface p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Metriche</h2>
        {metrics && metrics.length > 0 && (
          <button onClick={() => setShowForm(true)} className="text-xs text-accent underline underline-offset-4">
            + Registra valore
          </button>
        )}
      </div>

      {error && <p className="mb-2 text-xs text-negative">{error}</p>}

      {metrics === null ? (
        <p className="text-sm text-muted">Caricamento…</p>
      ) : metricsWithHistory.length === 0 ? (
        <p className="text-sm text-muted">Nessun valore registrato ancora per le metriche di {metrics.length === 1 ? "questo sport" : "questo sport"}.</p>
      ) : (
        <div className="space-y-4">
          {metricsWithHistory.map(({ metric, points }) => (
            <MetricTrendChart key={metric.id} metric={metric} points={points} />
          ))}
        </div>
      )}

      {showForm && metrics && (
        <NewMetricValueForm
          basePath={basePath}
          metrics={metrics}
          defaultMetricId={metrics[0]?.id ?? ""}
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

function MetricTrendChart({ metric, points }: { metric: SportMetric; points: MetricValue[] }) {
  const sorted = useMemo(() => points.slice().sort((a, b) => +new Date(a.recordedAt) - +new Date(b.recordedAt)), [points]);
  const last = sorted[sorted.length - 1];
  const unit = metric.unit ?? "";

  if (sorted.length < 2) {
    return (
      <div className="rounded-lg bg-surface-2 p-3">
        <p className="text-xs font-medium text-muted">{metric.name}</p>
        <p className="mt-1 text-sm">
          {last.value}
          {unit} <span className="text-xs text-muted">({new Date(last.recordedAt).toLocaleDateString("it-IT")})</span>
        </p>
      </div>
    );
  }

  const vals = sorted.map((p) => p.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const w = 100;
  const h = 32;
  const coords = sorted.map((p, i) => {
    const x = sorted.length === 1 ? 0 : (i / (sorted.length - 1)) * w;
    const y = h - ((p.value - min) / range) * h;
    return `${x},${y}`;
  });

  const prev = sorted[sorted.length - 2].value;
  const trend = last.value > prev ? "up" : last.value < prev ? "down" : "flat";

  return (
    <div className="rounded-lg bg-surface-2 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted">{metric.name}</p>
        <span className={`text-xs font-medium ${trend === "up" ? "text-improving" : trend === "down" ? "text-negative" : "text-muted"}`}>
          {trend === "up" ? "↑" : trend === "down" ? "↓" : "→"} {last.value}
          {unit}
        </span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-14 w-full text-accent">
        <polyline points={coords.join(" ")} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}

function NewMetricValueForm({
  basePath,
  metrics,
  defaultMetricId,
  onClose,
  onCreated,
  onError,
}: {
  basePath: string;
  metrics: SportMetric[];
  defaultMetricId: string;
  onClose: () => void;
  onCreated: () => void;
  onError: (msg: string | null) => void;
}) {
  const [sportMetricId, setSportMetricId] = useState(defaultMetricId);
  const [value, setValue] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const selected = metrics.find((m) => m.id === sportMetricId);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const numeric = Number(value.replace(",", "."));
    if (!value.trim() || !Number.isFinite(numeric)) {
      setLocalError("Inserisci un valore numerico valido.");
      return;
    }
    setBusy(true);
    setLocalError(null);
    onError(null);

    const res = await fetch(`${basePath}/metrics`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sportMetricId, value: numeric, notes: notes.trim() || undefined }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setLocalError(data.error ?? "Errore durante il salvataggio.");
      return;
    }
    trackClient("metric_value_recorded", {});
    onCreated();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full max-w-md animate-scale-in space-y-4 overflow-y-auto rounded-xl border border-border bg-surface p-6"
      >
        <h2 className="text-lg font-semibold">Registra valore</h2>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted">Metrica</label>
          <select
            value={sportMetricId}
            onChange={(e) => setSportMetricId(e.target.value)}
            className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
          >
            {metrics.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
                {m.unit ? ` (${m.unit})` : ""}
              </option>
            ))}
          </select>
          {selected?.description && <p className="mt-1 text-xs text-muted">{selected.description}</p>}
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted">Valore{selected?.unit ? ` (${selected.unit})` : ""}</label>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            inputMode="decimal"
            className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
          />
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
