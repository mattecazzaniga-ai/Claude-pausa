export type TeamMemberData = { id: string; name: string; level: string | null };

export type TeamSessionListItem = {
  id: string;
  objective: string | null;
  durationMinutes: number;
  createdAt: string;
};

export type TeamData = {
  id: string;
  name: string;
  sportName: string;
  members: TeamMemberData[];
  availableAthletes: { id: string; name: string }[];
  sessions: TeamSessionListItem[];
};
