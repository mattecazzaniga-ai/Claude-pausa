"use client";

import { useEffect, useState } from "react";

type OverallInjuryStatus = "NONE" | "MONITORED" | "PARTIAL" | "ACTIVE_INJURY";

const OVERALL_INJURY_CONFIG: Record<OverallInjuryStatus, { emoji: string; label: string }> = {
  NONE: { emoji: "🟢", label: "Nessuna limitazione registrata" },
  MONITORED: { emoji: "🟡", label: "Fastidio monitorato" },
  PARTIAL: { emoji: "🟠", label: "Limitazione parziale" },
  ACTIVE_INJURY: { emoji: "🔴", label: "Infortunio / indisponibilità" },
};

type MetricBaseline = {
  sportMetricId: string;
  name: string;
  unit: string | null;
  currentValue: number;
  currentDate: string;
  personalBest: { value: number; date: string } | null;
};

type ComparisonRow = { category: string; name: string; baseline: string | null; current: string };
type Objective = { title: string; kind: string; baselineValue: string | null; targetValue: string | null; currentValue: string | null; unit: string | null };
type Checkin = { date: string; readiness: number | null; rpe: number | null; feeling: string | null };

type DigitalTwin = {
  name: string;
  sportName: string;
  level: string | null;
  overallInjuryStatus: OverallInjuryStatus;
  aiSummary: string | null;
  priorities: { skill: string; reason: string }[];
  methodology: { version: number | null; principleCount: number };
  baseline: MetricBaseline[];
  evaluationComparison: ComparisonRow[];
  daysSinceLastEvaluation: number | null;
  activeObjectives: Objective[];
  recentCheckins: Checkin[];
  upcomingCompetition: { name: string; daysUntil: number } | null;
};

/**
 * Master prompt's "Athlete Digital Twin": one coherent snapshot of what the
 * app already knows about this athlete, instead of the coach piecing it
 * together across seven tabs. Pure read of already-computed data (see
 * lib/digital-twin.ts) — no new AI call happens here.
 */
export function DigitalTwinSection({ basePath }: { basePath: string }) {
  const [twin, setTwin] = useState<DigitalTwin | null>(null);

  useEffect(() => {
    fetch(`${basePath}/digital-twin`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setTwin(data?.twin ?? null));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- basePath is fixed for the component's lifetime
  }, [basePath]);

  if (!twin) return <p className="text-sm text-muted">Caricamento…</p>;

  const injuryConfig = OVERALL_INJURY_CONFIG[twin.overallInjuryStatus];
  const lastCheckin = twin.recentCheckins[0] ?? null;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">{twin.name}</h2>
            <p className="text-sm text-muted">
              {twin.sportName}
              {twin.level ? ` · ${twin.level}` : ""}
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-xs text-muted">
            <span>{injuryConfig.emoji}</span>
            {injuryConfig.label}
          </span>
        </div>

        {twin.aiSummary ? (
          <p className="mt-3 text-sm text-foreground/90">{twin.aiSummary}</p>
        ) : (
          <p className="mt-3 text-sm text-muted">Nessuna sintesi AI ancora disponibile.</p>
        )}

        {twin.priorities.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {twin.priorities.map((p, i) => (
              <span key={i} className="rounded-full bg-accent/10 px-2.5 py-1 text-xs text-accent">
                {p.skill}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Metodologia applicata</p>
          {twin.methodology.version ? (
            <p className="mt-1.5 text-sm text-foreground/90">
              Versione {twin.methodology.version} — {twin.methodology.principleCount} {twin.methodology.principleCount === 1 ? "principio" : "principi"} dichiarati
            </p>
          ) : (
            <p className="mt-1.5 text-sm text-muted">Nessuna metodologia dichiarata ancora.</p>
          )}
        </div>

        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Valutazioni</p>
          {twin.evaluationComparison.length > 0 ? (
            <p className="mt-1.5 text-sm text-foreground/90">
              {twin.evaluationComparison.length} criteri valutati, ultima {twin.daysSinceLastEvaluation ?? "?"} giorni fa
            </p>
          ) : (
            <p className="mt-1.5 text-sm text-muted">Nessuna valutazione registrata ancora.</p>
          )}
        </div>

        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Ultimo check-in</p>
          {lastCheckin ? (
            <p className="mt-1.5 text-sm text-foreground/90">
              {new Date(lastCheckin.date).toLocaleDateString("it-IT")}
              {lastCheckin.readiness != null ? ` — prontezza ${lastCheckin.readiness}/10` : ""}
              {lastCheckin.feeling ? ` — ${lastCheckin.feeling.toLowerCase()}` : ""}
            </p>
          ) : (
            <p className="mt-1.5 text-sm text-muted">Nessun check-in registrato ancora.</p>
          )}
        </div>

        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Prossima competizione</p>
          {twin.upcomingCompetition ? (
            <p className="mt-1.5 text-sm text-foreground/90">
              {twin.upcomingCompetition.name} tra {twin.upcomingCompetition.daysUntil} giorni
            </p>
          ) : (
            <p className="mt-1.5 text-sm text-muted">Nessuna competizione in programma.</p>
          )}
        </div>
      </div>

      {twin.activeObjectives.length > 0 && (
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Obiettivi attivi</p>
          <div className="mt-2 space-y-1.5">
            {twin.activeObjectives.map((o, i) => (
              <p key={i} className="text-sm text-foreground/90">
                {o.title}
                {o.kind === "QUANTITATIVE" && o.currentValue ? ` — ${o.baselineValue ?? "?"} → ${o.currentValue} → target ${o.targetValue ?? "?"}${o.unit ?? ""}` : ""}
              </p>
            ))}
          </div>
        </div>
      )}

      {twin.baseline.length > 0 && (
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Baseline metriche</p>
          <div className="mt-2 space-y-1.5">
            {twin.baseline.map((b) => (
              <p key={b.sportMetricId} className="text-sm text-foreground/90">
                {b.name}: {b.currentValue}
                {b.unit ?? ""}
                {b.personalBest && b.personalBest.value !== b.currentValue ? ` (record ${b.personalBest.value}${b.unit ?? ""})` : ""}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
