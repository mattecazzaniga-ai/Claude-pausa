/**
 * Adaptive Training Engine (master prompt: adatta il carico di allenamento
 * allo stato reale dell'atleta, non solo a quanto richiesto dal coach).
 *
 * Deliberately rule-based on the athlete's own self-reported numbers
 * (readiness, RPE, sonno, indolenzimento — all established sports-science
 * self-report scales, see AthleteCheckin) plus recent session feedback —
 * never a fabricated composite "readiness score" (master prompt §22). Every
 * reason cited is one real recorded value, so a coach can always see exactly
 * why an adjustment was suggested.
 *
 * No checkin/feedback data at all -> returns null -> the session generator
 * behaves exactly as before this feature existed (backward compatible for
 * every coach not using check-ins).
 */

export type AdaptationLevel = "REDUCE" | "INCREASE";

export type AdaptationSignal = {
  level: AdaptationLevel;
  reasons: string[];
};

const CHECKIN_RECENCY_HOURS = 36;
const FEEDBACK_RECENCY_DAYS = 14;

const LOW_READINESS = 4;
const HIGH_READINESS = 9;
const HIGH_SORENESS = 8;
const LOW_SORENESS = 2;
const HIGH_RPE = 9;
const MODERATE_RPE = 5;
const LOW_SLEEP_HOURS = 5;

export type CheckinInput = {
  date: Date;
  readiness: number | null;
  rpe: number | null;
  soreness: number | null;
  sleepHours: number | null;
};

export type RecentSessionInput = {
  createdAt: Date;
  feedbackRating: "EXCELLENT" | "GOOD" | "AVERAGE" | "NEEDS_WORK" | null;
};

function hoursSince(date: Date, now: Date): number {
  return (now.getTime() - date.getTime()) / (1000 * 60 * 60);
}

function daysSince(date: Date, now: Date): number {
  return hoursSince(date, now) / 24;
}

export function computeAdaptationSignal(
  input: { latestCheckin: CheckinInput | null; recentSessions: RecentSessionInput[] },
  now: Date = new Date()
): AdaptationSignal | null {
  const reduceReasons: string[] = [];
  const increaseReasons: string[] = [];

  const checkin = input.latestCheckin && hoursSince(input.latestCheckin.date, now) <= CHECKIN_RECENCY_HOURS ? input.latestCheckin : null;

  if (checkin) {
    if (checkin.readiness != null && checkin.readiness <= LOW_READINESS) {
      reduceReasons.push(`prontezza bassa (${checkin.readiness}/10)`);
    }
    if (checkin.soreness != null && checkin.soreness >= HIGH_SORENESS) {
      reduceReasons.push(`indolenzimento elevato (${checkin.soreness}/10)`);
    }
    if (checkin.rpe != null && checkin.rpe >= HIGH_RPE) {
      reduceReasons.push(`sforzo percepito molto alto nell'ultimo check-in (${checkin.rpe}/10)`);
    }
    if (checkin.sleepHours != null && checkin.sleepHours < LOW_SLEEP_HOURS) {
      reduceReasons.push(`sonno insufficiente (${checkin.sleepHours}h)`);
    }

    if (
      reduceReasons.length === 0 &&
      checkin.readiness != null &&
      checkin.readiness >= HIGH_READINESS &&
      (checkin.soreness == null || checkin.soreness <= LOW_SORENESS) &&
      (checkin.rpe == null || checkin.rpe <= MODERATE_RPE)
    ) {
      increaseReasons.push(`prontezza molto alta (${checkin.readiness}/10)`);
      if (checkin.soreness != null) increaseReasons.push(`nessun indolenzimento (${checkin.soreness}/10)`);
    }
  }

  const recentQualifying = input.recentSessions.filter((s) => daysSince(s.createdAt, now) <= FEEDBACK_RECENCY_DAYS);
  if (recentQualifying.length >= 2 && recentQualifying.slice(0, 2).every((s) => s.feedbackRating === "NEEDS_WORK")) {
    reduceReasons.push("le ultime 2 sessioni sono state valutate come da migliorare");
  }

  if (reduceReasons.length > 0) return { level: "REDUCE", reasons: reduceReasons };
  if (increaseReasons.length > 0) return { level: "INCREASE", reasons: increaseReasons };
  return null;
}

/** Instruction spliced into the AI session-generation prompt. */
export function formatAdaptationDirective(signal: AdaptationSignal): string {
  const reasonsText = signal.reasons.join("; ");
  if (signal.level === "REDUCE") {
    return (
      `ADATTAMENTO AUTOMATICO — riduci il carico rispetto al normale: privilegia blocchi tecnici/tattici a bassa intensità, ` +
      `allunga i recuperi, evita o accorcia i blocchi fisici/di gioco ad alta intensità. Motivo: ${reasonsText}.`
    );
  }
  return (
    `ADATTAMENTO AUTOMATICO — l'atleta è pienamente pronto: puoi proporre un carico o un'intensità leggermente superiori al solito, ` +
    `se la sessione richiesta lo consente. Motivo: ${reasonsText}.`
  );
}

/** Human-readable note persisted on the TrainingSession and shown to the coach. */
export function formatAdaptationNote(signal: AdaptationSignal): string {
  const reasonsText = signal.reasons.join("; ");
  return signal.level === "REDUCE" ? `Carico ridotto automaticamente — ${reasonsText}.` : `Carico aumentato automaticamente — ${reasonsText}.`;
}
