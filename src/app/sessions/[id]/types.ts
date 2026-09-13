export type SessionBlockData = {
  id: string;
  order: number;
  type: "WARMUP" | "TECHNICAL" | "TACTICAL" | "PHYSICAL" | "GAME" | "COOLDOWN";
  durationMinutes: number;
  rationale: string | null;
  exercise: {
    id: string;
    name: string;
    description: string | null;
    coachingPoints: string | null;
    commonMistakes: string | null;
    equipment: string | null;
    source: "COACH_CREATED" | "AI_GENERATED";
    skills: string[];
  } | null;
};

export type TrainingSessionData = {
  id: string;
  objective: string | null;
  durationMinutes: number;
  createdAt: string;
  athlete: { id: string; name: string } | null;
  team: { id: string; name: string } | null;
  blocks: SessionBlockData[];
  feedbackRating: "EXCELLENT" | "GOOD" | "AVERAGE" | "NEEDS_WORK" | null;
  feedbackNote: string | null;
};
