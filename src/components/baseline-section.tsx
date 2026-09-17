"use client";

import { useEffect, useState } from "react";
import { trackClient } from "@/lib/track-client";

type MetricBaseline = {
  sportMetricId: string;
  name: string;
  unit: string | null;
  direction: "HIGHER_IS_BETTER" | "LOWER_IS_BETTER" | null;
  initialValue: number;
  initialDate: string;
  currentValue: number;
  currentDate: string;
  personalBest: { value: number; date: string } | null;
  seasonBest: { value: number; date: string } | null;
};

type PerformanceLevelAssessment = {
  provenance: "INSUFFICIENT_DATA" | "ASSESSED";
  level: string | null;
  explanation: string | null;
  basedOn: string[];
};

type MainGap = {
  hasEnoughData: boolean;
  objectiveTitle: string | null;
  current: string | null;
  target: string | null;
  unit: string | null;
  gapExplanation: string | null;
  priorityReason: string | null;
};

/**
 * Master prompt §4/§6-7/§13-14: Baseline (pure computation, loaded eagerly)
 * plus two on-demand ephemeral AI reads — Performance Level and the Gap
 * Engine's single most important gap — mirroring NextBestActionCard's
 * "generate on click, never auto-run" pattern for AI calls.
 */
export function BaselineSection({ basePath }: { basePath: string }) {
  const [baseline, setBaseline] = useState<MetricBaseline[] | null>(null);

  const [level, setLevel] = useState<PerformanceLevelAssessment | null>(null);
  const [assessingLevel, setAssessingLevel] = useState(false);
  const [levelError, setLevelError] = useState<string | null>(null);

  const [gap, setGap] = useState<MainGap | null>(null);
  const [computingGap, setComputingGap] = useState(false);
  const [gapError, setGapError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${basePath}/baseline`)
      .then((res) => (res.ok ? res.json() : { baseline: [] }))
      .then((data) => setBaseline(data.baseline ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- basePath is fixed for the component's lifetime
  }, [basePath]);

  async function assessLevel() {
    setAssessingLevel(true);
    setLevelError(null);
    const res = await fetch(`${basePath}/performance-level`, { method: "POST" });
    const data = await res.json();
    setAssessingLevel(false);
    if (!res.ok) {
      setLevelError(data.error ?? "Errore durante la valutazione.");
      return;
    }
    setLevel(data.assessment);
    trackClient("performance_level_assessed", {});
  }

  async function computeGap() {
    setComputingGap(true);
    setGapError(null);
    const res = await fetch(`${basePath}/gap`, { method: "POST" });
    const data = await res.json();
    setComputingGap(false);
    if (!res.ok) {
      setGapError(data.error ?? "Errore durante il calcolo del gap.");
      return;
    }
    setGap(data.gap);
    trackClient("main_gap_computed", {});
  }

  return (
    <div className="mb-8 rounded-xl border border-border bg-surface p-5">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">Baseline & Livello di performance</h2>

      {baseline === null ? (
        <p className="text-sm text-muted">Caricamento…</p>
      ) : baseline.length === 0 ? (
        <p className="text-sm text-muted">Nessuna baseline ancora: registra qualche valore nelle Metriche per vedere qui il percorso da dove sei partito a dove sei ora.</p>
      ) : (
        <div className="mb-4 space-y-2">
          {baseline.map((b) => (
            <div key={b.sportMetricId} className="rounded-lg bg-surface-2 p-3">
              <p className="text-xs font-medium text-muted">{b.name}</p>
              <p className="mt-1 text-sm">
                Partenza: {b.initialValue}
                {b.unit ?? ""} ({new Date(b.initialDate).toLocaleDateString("it-IT")}) → Attuale: {b.currentValue}
                {b.unit ?? ""} ({new Date(b.currentDate).toLocaleDateString("it-IT")})
              </p>
              {(b.personalBest || b.seasonBest) && (
                <p className="mt-1 text-xs text-muted">
                  {b.personalBest && (
                    <>
                      Record personale: {b.personalBest.value}
                      {b.unit ?? ""} ({new Date(b.personalBest.date).toLocaleDateString("it-IT")})
                    </>
                  )}
                  {b.personalBest && b.seasonBest && " · "}
                  {b.seasonBest && (
                    <>
                      Record stagionale: {b.seasonBest.value}
                      {b.unit ?? ""} ({new Date(b.seasonBest.date).toLocaleDateString("it-IT")})
                    </>
                  )}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-t border-border pt-4">
        <button
          onClick={assessLevel}
          disabled={assessingLevel}
          className="rounded-md border border-border px-3 py-1.5 text-xs transition-colors hover:bg-surface-2 disabled:opacity-50"
        >
          {assessingLevel ? "Valutazione…" : "Qual è il livello attuale?"}
        </button>
        <button
          onClick={computeGap}
          disabled={computingGap}
          className="rounded-md border border-border px-3 py-1.5 text-xs transition-colors hover:bg-surface-2 disabled:opacity-50"
        >
          {computingGap ? "Analisi…" : "Qual è il gap principale?"}
        </button>
      </div>

      {levelError && <p className="mt-2 text-xs text-negative">{levelError}</p>}
      {level && (
        <div className="mt-3 rounded-md border border-dashed border-border p-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted">Livello attuale</p>
          {level.provenance === "INSUFFICIENT_DATA" ? (
            <p className="mt-1.5 text-sm text-muted">Non ci sono ancora abbastanza dati (valutazioni, metriche, competizioni) per stimare un livello affidabile.</p>
          ) : (
            <>
              <p className="mt-1.5 text-sm font-medium text-accent">{level.level}</p>
              {level.explanation && <p className="mt-1 text-sm text-foreground/90">{level.explanation}</p>}
              {level.basedOn.length > 0 && (
                <ul className="mt-2 space-y-0.5">
                  {level.basedOn.map((b, i) => (
                    <li key={i} className="text-xs text-muted">
                      • {b}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}

      {gapError && <p className="mt-2 text-xs text-negative">{gapError}</p>}
      {gap && (
        <div className="mt-3 rounded-md border border-dashed border-border p-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted">Gap principale</p>
          {!gap.hasEnoughData ? (
            <p className="mt-1.5 text-sm text-muted">Nessun obiettivo quantitativo con valore attuale e target sufficiente per calcolare un gap.</p>
          ) : (
            <>
              <p className="mt-1.5 text-sm font-semibold">{gap.objectiveTitle}</p>
              <p className="mt-1 text-sm text-foreground/90">
                {gap.current} → {gap.target}
                {gap.unit ?? ""}
              </p>
              {gap.gapExplanation && <p className="mt-1 text-sm text-foreground/80">{gap.gapExplanation}</p>}
              {gap.priorityReason && (
                <p className="mt-2 rounded-md bg-surface-2 p-2 text-xs text-muted">
                  <span className="font-medium text-foreground/70">Perché ora: </span>
                  {gap.priorityReason}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
