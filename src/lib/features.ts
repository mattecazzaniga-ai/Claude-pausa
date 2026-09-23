/**
 * Catalogo delle aree del prodotto mostrate nello step di onboarding "cosa
 * ti interessa di più" (subito dopo la scelta dello sport) e riusato per
 * evidenziare quelle scelte nella riga di scorciatoie della Home. Gli id e
 * gli href rispecchiano esattamente le voci già presenti in <Nav/>, non ne
 * inventano di nuove.
 */

export type FeatureId = "athletes" | "teams" | "calendar" | "exercises" | "coach-brain" | "payments";

export type FeatureDef = {
  id: FeatureId;
  label: string;
  href: string;
  description: string;
};

export const ALL_FEATURES: FeatureDef[] = [
  {
    id: "athletes",
    label: "Atleti",
    href: "/athletes",
    description: "Profilo completo di ogni atleta: obiettivi, valutazioni, infortuni e storico sessioni.",
  },
  {
    id: "teams",
    label: "Squadre",
    href: "/teams",
    description: "Gestisci il roster e genera sessioni per un intero gruppo.",
  },
  {
    id: "calendar",
    label: "Calendario",
    href: "/calendar",
    description: "Programma allenamenti, valutazioni e competizioni in un'unica vista settimanale.",
  },
  {
    id: "exercises",
    label: "Esercizi",
    href: "/exercises",
    description: "La tua libreria di esercizi, riutilizzabile in ogni sessione che generi.",
  },
  {
    id: "coach-brain",
    label: "Coach Brain",
    href: "/coach-brain",
    description: "L'AI impara dal tuo modo di allenare e suggerisce la prossima mossa.",
  },
  {
    id: "payments",
    label: "Pagamenti",
    href: "/payments",
    description: "Prezzi, pacchetti, incassi e scadenze delle lezioni.",
  },
];

const FEATURE_IDS = ALL_FEATURES.map((f) => f.id) as [FeatureId, ...FeatureId[]];

/** Un coach self-coaching non gestisce altri atleti, squadre o pagamenti: stesso sottoinsieme già nascosto in <Nav/>. */
const SELF_COACHING_FEATURE_IDS: readonly FeatureId[] = ["calendar", "exercises", "coach-brain"];

export function getFeaturesFor(selfCoaching: boolean): FeatureDef[] {
  return selfCoaching ? ALL_FEATURES.filter((f) => SELF_COACHING_FEATURE_IDS.includes(f.id)) : ALL_FEATURES;
}

export function isValidFeatureId(id: string): id is FeatureId {
  return (FEATURE_IDS as readonly string[]).includes(id);
}

export { FEATURE_IDS };
