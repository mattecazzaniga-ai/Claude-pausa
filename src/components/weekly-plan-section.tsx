"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { trackClient } from "@/lib/track-client";

type PlanPhase = "CARICO" | "SCARICO" | "MANTENIMENTO";
type PlanIntensity = "ALTA" | "MEDIA" | "BASSA";

type PlannedSlot = {
  id: string;
  order: number;
  intensity: PlanIntensity;
  discipline: string | null;
  focus: string;
  trainingSessionId: string | null;
};

type WeeklyPlan = {
  id: string;
  phase: PlanPhase;
  rationale: string;
  sessionsPerWeek: number;
  slots: PlannedSlot[];
};

const PHASE_LABEL: Record<PlanPhase, string> = { CARICO: "Carico", SCARICO: "Scarico", MANTENIMENTO: "Mantenimento" };
const PHASE_STYLE: Record<PlanPhase, string> = {
  CARICO: "bg-accent/15 text-accent",
  SCARICO: "bg-improving/15 text-improving",
  MANTENIMENTO: "bg-surface-2 text-muted",
};
const INTENSITY_LABEL: Record<PlanIntensity, string> = { ALTA: "Alta", MEDIA: "Media", BASSA: "Bassa" };
const INTENSITY_STYLE: Record<PlanIntensity, string> = {
  ALTA: "bg-negative/15 text-negative",
  MEDIA: "bg-improving/15 text-improving",
  BASSA: "bg-positive/15 text-positive",
};

/**
 * Feedback utente: "posso impostare quante volte a settimana mi alleno e il
 * carico si distribuisce di conseguenza" + "l'AI deve essere più precisa su
 * carico/scarico" + sport multi-disciplina come il triathlon. Genera lo
 * SCHELETRO di una settimana (fase + una riga per sessione); ogni riga viene
 * poi "riempita" in una sessione reale riusando lo stesso generatore già
 * esistente per la singola sessione — basePath è /api/athletes/{id} o
 * /api/teams/{id}, le route sono simmetriche per entrambi.
 */
export function WeeklyPlanSection({ basePath }: { basePath: string }) {
  const router = useRouter();
  const [plan, setPlan] = useState<WeeklyPlan | null | undefined>(undefined);
  const [sessionsPerWeek, setSessionsPerWeek] = useState("3");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fillingSlotId, setFillingSlotId] = useState<string | null>(null);
  const [slotDuration, setSlotDuration] = useState("60");

  useEffect(() => {
    fetch(`${basePath}/weekly-plan`)
      .then((res) => (res.ok ? res.json() : { plan: null, trainingDaysPerWeek: null }))
      .then((data) => {
        setPlan(data.plan ?? null);
        if (data.trainingDaysPerWeek) setSessionsPerWeek(String(data.trainingDaysPerWeek));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- basePath is fixed for the component's lifetime
  }, [basePath]);

  async function generatePlan() {
    setGenerating(true);
    setError(null);
    const res = await fetch(`${basePath}/weekly-plan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionsPerWeek: Number(sessionsPerWeek) || 3 }),
    });
    const data = await res.json();
    setGenerating(false);
    if (!res.ok) {
      setError(data.error ?? "Errore durante la generazione.");
      return;
    }
    setPlan(data.plan);
    trackClient("weekly_plan_generated", {});
  }

  async function fillSlot(slotId: string) {
    setError(null);
    const res = await fetch(`${basePath}/weekly-plan/slots/${slotId}/fill`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ durationMinutes: Number(slotDuration) || 60 }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Errore durante la generazione della sessione.");
      return;
    }
    setPlan((prev) => (prev ? { ...prev, slots: prev.slots.map((s) => (s.id === slotId ? { ...s, trainingSessionId: data.sessionId } : s)) } : prev));
    setFillingSlotId(null);
    trackClient("weekly_plan_slot_filled", {});
  }

  return (
    <div className="mb-6 rounded-xl border border-border bg-surface p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Piano settimanale</h2>
        {plan && (
          <button onClick={() => setPlan(null)} className="text-xs text-accent underline underline-offset-4">
            Nuovo piano
          </button>
        )}
      </div>

      {error && <p className="mb-2 text-xs text-negative">{error}</p>}

      {plan === undefined ? (
        <p className="text-sm text-muted">Caricamento…</p>
      ) : !plan ? (
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">Sessioni a settimana</label>
            <input
              type="number"
              min={1}
              max={14}
              value={sessionsPerWeek}
              onChange={(e) => setSessionsPerWeek(e.target.value)}
              className="w-24 rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>
          <button
            onClick={generatePlan}
            disabled={generating}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {generating ? "Generazione…" : "Genera piano settimanale"}
          </button>
          <p className="w-full text-xs text-muted">L&apos;AI distribuisce il carico (alta/media/bassa intensità) sulla settimana in base allo storico reale.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${PHASE_STYLE[plan.phase]}`}>Settimana di {PHASE_LABEL[plan.phase]}</span>
          </div>
          <p className="text-sm text-foreground/80">{plan.rationale}</p>

          <div className="space-y-2 pt-1">
            {plan.slots.map((slot) => (
              <div key={slot.id} className="rounded-lg bg-surface-2 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted">Sessione {slot.order}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${INTENSITY_STYLE[slot.intensity]}`}>{INTENSITY_LABEL[slot.intensity]}</span>
                    {slot.discipline && <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] text-muted">{slot.discipline}</span>}
                  </div>
                  {slot.trainingSessionId ? (
                    <button onClick={() => router.push(`/sessions/${slot.trainingSessionId}`)} className="text-xs text-accent underline underline-offset-4">
                      Vai alla sessione
                    </button>
                  ) : fillingSlotId === slot.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={10}
                        max={240}
                        value={slotDuration}
                        onChange={(e) => setSlotDuration(e.target.value)}
                        className="w-16 rounded-md border border-border bg-surface px-2 py-1 text-xs outline-none focus:border-accent"
                      />
                      <button onClick={() => fillSlot(slot.id)} className="rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-black hover:opacity-90">
                        Genera
                      </button>
                      <button onClick={() => setFillingSlotId(null)} className="text-xs text-muted hover:underline">
                        Annulla
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setFillingSlotId(slot.id)} className="text-xs text-accent underline underline-offset-4">
                      Genera sessione
                    </button>
                  )}
                </div>
                <p className="mt-1.5 text-sm text-foreground/90">{slot.focus}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
