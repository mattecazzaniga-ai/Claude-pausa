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
