export type NoteTagData = { skillName: string; sentiment: "POSITIVE" | "NEGATIVE" | "NEUTRAL" | "IMPROVING"; excerpt: string };

export type SessionNoteData = {
  id: string;
  rawText: string;
  sessionDate: string;
  aiProcessed: boolean;
  tags: NoteTagData[];
};

import type { GoalData } from "@/components/objectives-section";
export type { GoalData };

export type TrainingSessionListItem = {
  id: string;
  objective: string | null;
  durationMinutes: number;
  createdAt: string;
};

export type AthleteData = {
  id: string;
  name: string;
  level: string | null;
  objectives: string | null;
  sportName: string;
  aiSummary: string | null;
  aiPriorities: { skill: string; reason: string }[];
  aiSummaryUpdatedAt: string | null;
  notes: SessionNoteData[];
  goals: GoalData[];
  isSelf: boolean;
  trainingSessions: TrainingSessionListItem[];
};
