/**
 * Carico di allenamento giornaliero — metodo sessione-RPE (Foster, 2001)
 * esteso con due moltiplicatori espliciti invece di un punteggio composito
 * opaco (stessa filosofia di lib/adaptive-training.ts: ogni numero deve
 * restare spiegabile).
 *
 * Formula:
 *   carico = durata (minuti) × sforzo percepito (RPE 0-10)
 *          × coefficiente di disciplina × moltiplicatore di zona
 *
 * - Il coefficiente di disciplina pesa l'impatto reale a parità di durata e
 *   RPE: la corsa carica di più le articolazioni (impatto ad ogni appoggio)
 *   rispetto a nuoto/bici, che sono a basso impatto — esattamente come
 *   descritto dal coach. Una disciplina non riconosciuta usa il coefficiente
 *   neutro (1×) invece di bloccare l'inserimento o inventare un numero senza
 *   basi: ogni sport è diverso, e per la maggior parte non esiste in
 *   letteratura un coefficiente di impatto consolidato.
 * - Il moltiplicatore di zona distingue il tipo di sessione (riscaldamento
 *   vs gara, ecc.) anche a parità di durata e RPE dichiarati.
 */

export type TrainingZone = "WARMUP" | "EASY" | "MODERATE" | "HARD" | "RACE";

export const TRAINING_ZONES: TrainingZone[] = ["WARMUP", "EASY", "MODERATE", "HARD", "RACE"];

export const TRAINING_ZONE_LABEL: Record<TrainingZone, string> = {
  WARMUP: "Riscaldamento",
  EASY: "Facile",
  MODERATE: "Moderato",
  HARD: "Intenso",
  RACE: "Gara",
};

const ZONE_MULTIPLIER: Record<TrainingZone, number> = {
  WARMUP: 0.6,
  EASY: 0.8,
  MODERATE: 1,
  HARD: 1.2,
  RACE: 1.4,
};

export function getZoneMultiplier(zone: TrainingZone): number {
  return ZONE_MULTIPLIER[zone];
}

export const DEFAULT_DISCIPLINE_COEFFICIENT = 1;

/**
 * Coefficienti indicativi per le discipline di resistenza dove la differenza
 * di impatto è consolidata (corsa > bici/canottaggio > nuoto/camminata,
 * essendo queste ultime a basso o nullo impatto articolare). Per ogni altro
 * sport (es. Calcio, Basket, Tennis...) non esiste un coefficiente
 * ugualmente fondato: resta il valore neutro 1×, mostrato comunque in modo
 * trasparente invece di nascondere il calcolo.
 */
const DISCIPLINE_COEFFICIENTS: { label: string; coefficient: number; synonyms: string[] }[] = [
  { label: "Corsa", coefficient: 1.1, synonyms: ["corsa", "running", "run", "podismo"] },
  { label: "Ciclismo / bici", coefficient: 0.85, synonyms: ["ciclismo", "bici", "bicicletta", "bike", "cycling", "mtb"] },
  { label: "Canottaggio / voga", coefficient: 0.9, synonyms: ["canottaggio", "voga", "rowing", "canoa", "kayak"] },
  { label: "Sci di fondo", coefficient: 0.9, synonyms: ["sci di fondo", "cross country skiing"] },
  { label: "Nuoto", coefficient: 0.8, synonyms: ["nuoto", "swimming", "swim"] },
  { label: "Camminata / trekking", coefficient: 0.7, synonyms: ["camminata", "trekking", "walking", "cammino", "escursionismo"] },
];

/** Suggerimenti generici da offrire quando lo sport non ha discipline separate proprie. */
export const DISCIPLINE_SUGGESTIONS = DISCIPLINE_COEFFICIENTS.map((d) => d.label);

function normalize(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

/** Coefficiente stimato per una disciplina in testo libero — 1× (neutro) se non riconosciuta. */
export function getDisciplineCoefficient(discipline: string): number {
  const normalized = normalize(discipline);
  if (!normalized) return DEFAULT_DISCIPLINE_COEFFICIENT;

  const words = normalized.split(/\s+/);
  for (const entry of DISCIPLINE_COEFFICIENTS) {
    for (const synonym of entry.synonyms) {
      const matches = synonym.includes(" ") ? normalized === synonym : words.includes(synonym);
      if (matches) return entry.coefficient;
    }
  }
  return DEFAULT_DISCIPLINE_COEFFICIENT;
}

export function computeTrainingLoad(input: { durationMinutes: number; rpe: number; discipline: string; zone: TrainingZone }): number {
  const disciplineCoefficient = getDisciplineCoefficient(input.discipline);
  const zoneMultiplier = getZoneMultiplier(input.zone);
  const raw = input.durationMinutes * input.rpe * disciplineCoefficient * zoneMultiplier;
  return Math.round(raw);
}
