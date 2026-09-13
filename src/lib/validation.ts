import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Il nome deve avere almeno 2 caratteri").max(60),
  email: z.string().trim().toLowerCase().email("Inserisci un'email valida"),
  password: z.string().min(8, "La password deve avere almeno 8 caratteri").max(72),
});

export const createAthleteSchema = z.object({
  name: z.string().trim().min(2, "Il nome deve avere almeno 2 caratteri").max(80),
  birthYear: z.number().int().min(1930).max(new Date().getFullYear()).optional().nullable(),
  level: z.string().trim().max(40).optional().nullable(),
  objectives: z.string().trim().max(500).optional().nullable(),
});

export const createSessionNoteSchema = z.object({
  rawText: z.string().trim().min(5, "Scrivi almeno qualche parola").max(2000),
  sessionDate: z.string().datetime().optional(),
});

const exerciseCategoryEnum = z.enum(["TECHNICAL", "TACTICAL", "PHYSICAL", "COGNITIVE", "WARMUP", "COOLDOWN", "COMPETITIVE"]);
const exerciseFormatEnum = z.enum(["INDIVIDUAL", "PAIR", "SMALL_GROUP", "TEAM", "GAME"]);
const exerciseDifficultyEnum = z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED", "ELITE"]);

export const quickCreateExerciseSchema = z.object({
  description: z.string().trim().min(5, "Descrivi l'esercizio in almeno qualche parola").max(500),
});

export const generateSessionSchema = z.object({
  durationMinutes: z.number().int().min(10).max(240),
  objective: z.string().trim().max(300).optional(),
  equipment: z.string().trim().max(200).optional(),
  intensity: z.string().trim().max(40).optional(),
});

export const createExerciseSchema = z.object({
  name: z.string().trim().min(2, "Il nome deve avere almeno 2 caratteri").max(100),
  description: z.string().trim().max(1000).optional().nullable(),
  instructions: z.string().trim().max(2000).optional().nullable(),
  category: exerciseCategoryEnum,
  format: exerciseFormatEnum.optional().nullable(),
  difficulty: exerciseDifficultyEnum.optional().nullable(),
  durationMinutes: z.number().int().min(1).max(240).optional().nullable(),
  sets: z.number().int().min(1).max(50).optional().nullable(),
  reps: z.number().int().min(1).max(500).optional().nullable(),
  restSeconds: z.number().int().min(0).max(3600).optional().nullable(),
  intensity: z.string().trim().max(40).optional().nullable(),
  equipment: z.string().trim().max(200).optional().nullable(),
  minAthletes: z.number().int().min(1).max(200).optional().nullable(),
  maxAthletes: z.number().int().min(1).max(200).optional().nullable(),
  spaceRequired: z.string().trim().max(100).optional().nullable(),
  coachingPoints: z.string().trim().max(1000).optional().nullable(),
  commonMistakes: z.string().trim().max(1000).optional().nullable(),
  progressionNote: z.string().trim().max(500).optional().nullable(),
  regressionNote: z.string().trim().max(500).optional().nullable(),
  tags: z.array(z.string().trim().max(30)).max(10).optional(),
  skillIds: z.array(z.string()).max(15).optional(),
});
