export type NoteTagData = { skillName: string; sentiment: "POSITIVE" | "NEGATIVE" | "NEUTRAL" | "IMPROVING"; excerpt: string };

export type SessionNoteData = {
  id: string;
  rawText: string;
  sessionDate: string;
  aiProcessed: boolean;
  tags: NoteTagData[];
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
};
