import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Il nome deve avere almeno 2 caratteri").max(60),
  email: z.string().trim().toLowerCase().email("Inserisci un'email valida"),
  password: z.string().min(8, "La password deve avere almeno 8 caratteri").max(72),
  selfCoaching: z.boolean().optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("Inserisci un'email valida"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token mancante"),
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

const objectiveTermLengthEnum = z.enum(["SHORT", "MEDIUM", "LONG"]);
const objectiveKindEnum = z.enum(["QUANTITATIVE", "QUALITATIVE"]);
const objectiveStatusEnum = z.enum(["ACTIVE", "ACHIEVED", "ABANDONED"]);

export const createObjectiveSchema = z.object({
  title: z.string().trim().min(2, "Il titolo deve avere almeno 2 caratteri").max(150),
  description: z.string().trim().max(1000).optional().nullable(),
  termLength: objectiveTermLengthEnum,
  kind: objectiveKindEnum,
  baselineValue: z.string().trim().max(50).optional().nullable(),
  targetValue: z.string().trim().max(50).optional().nullable(),
  currentValue: z.string().trim().max(50).optional().nullable(),
  unit: z.string().trim().max(20).optional().nullable(),
  deadline: z.string().datetime().optional().nullable(),
});

export const updateObjectiveSchema = z.object({
  currentValue: z.string().trim().max(50).optional().nullable(),
  status: objectiveStatusEnum.optional(),
});

const evaluationScoreTypeEnum = z.enum([
  "SCALE_1_5",
  "SCALE_1_10",
  "PERCENTAGE",
  "TIME_SECONDS",
  "DISTANCE_METERS",
  "REPETITIONS",
  "SUCCESS_RATE",
  "CUSTOM_NUMERIC",
  "QUALITATIVE",
]);

export const createEvaluationCriterionSchema = z.object({
  category: z.string().trim().min(1).max(60),
  name: z.string().trim().min(2, "Il nome deve avere almeno 2 caratteri").max(100),
  scoreType: evaluationScoreTypeEnum,
  targetLevel: z.string().trim().max(200).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
});

export const bulkCreateCriteriaSchema = z.object({
  criteria: z
    .array(
      z.object({
        category: z.string().trim().min(1, "La categoria è obbligatoria").max(60),
        name: z.string().trim().min(2, "Il nome deve avere almeno 2 caratteri").max(100),
        scoreType: evaluationScoreTypeEnum,
        targetLevel: z.string().trim().max(200).optional().nullable(),
      })
    )
    .min(1, "Aggiungi almeno un criterio")
    .max(60),
});

export const createEvaluationSchema = z.object({
  notes: z.string().trim().max(1000).optional().nullable(),
  scores: z
    .array(
      z.object({
        criterionId: z.string().min(1),
        value: z.string().trim().min(1).max(300),
        note: z.string().trim().max(300).optional().nullable(),
      })
    )
    .min(1, "Inserisci almeno un punteggio")
    .max(60),
});

const competitionTypeEnum = z.enum(["TOURNAMENT", "MATCH", "CHAMPIONSHIP", "LEAGUE", "FRIENDLY", "OTHER"]);
const competitionResultEnum = z.enum(["WIN", "LOSS", "DRAW", "NOT_RECORDED"]);

export const createCompetitionSchema = z.object({
  name: z.string().trim().min(2, "Il nome deve avere almeno 2 caratteri").max(150),
  type: competitionTypeEnum,
  scheduledAt: z.string().datetime(),
  location: z.string().trim().max(150).optional().nullable(),
  opponent: z.string().trim().max(150).optional().nullable(),
  importance: z.string().trim().max(200).optional().nullable(),
  preNotes: z.string().trim().max(1000).optional().nullable(),
});

export const recordCompetitionResultSchema = z.object({
  result: competitionResultEnum,
  score: z.string().trim().max(60).optional().nullable(),
  postNotes: z.string().trim().max(1500).optional().nullable(),
});

export const createCalendarEventSchema = z
  .object({
    type: z.enum(["TRAINING", "OTHER"]),
    title: z.string().trim().min(2, "Il titolo deve avere almeno 2 caratteri").max(150),
    startAt: z.string().datetime(),
    endAt: z.string().datetime(),
    athleteId: z.string().optional().nullable(),
    teamId: z.string().optional().nullable(),
    location: z.string().trim().max(150).optional().nullable(),
    notes: z.string().trim().max(1000).optional().nullable(),
    purchaseId: z.string().optional().nullable(),
    repeat: z
      .object({
        daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1).max(7),
        until: z.string().datetime(),
      })
      .optional(),
  })
  .refine((data) => !(data.athleteId && data.teamId), { message: "Scegli un atleta oppure una squadra, non entrambi." });

export const updateCalendarEventSchema = z.object({
  title: z.string().trim().min(2).max(150).optional(),
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
  location: z.string().trim().max(150).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
  trainingSessionId: z.string().optional(),
  purchaseId: z.string().optional().nullable(),
});

export const calendarEventStatusSchema = z.object({
  status: z.enum(["COMPLETED", "CANCELLED", "NO_SHOW"]),
  consumeCredit: z.boolean().optional(),
});

export const recommendationFeedbackSchema = z.object({
  feedback: z.enum(["USEFUL", "NOT_USEFUL"]),
  feedbackReason: z.string().trim().max(300).optional().nullable(),
});

export const sessionFeedbackSchema = z.object({
  rating: z.enum(["EXCELLENT", "GOOD", "AVERAGE", "NEEDS_WORK"]),
  note: z.string().trim().max(1500).optional().nullable(),
});

export const createTeamSchema = z.object({
  name: z.string().trim().min(2, "Il nome deve avere almeno 2 caratteri").max(80),
  // Athletes can be added later from the team page — a coach may want to
  // create the roster shell before knowing who's on it yet.
  athleteIds: z.array(z.string()).max(50).optional(),
});

export const addTeamMemberSchema = z.object({
  athleteId: z.string().min(1),
});

export const generateTeamSessionSchema = z.object({
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

const offerTypeEnum = z.enum(["SINGLE_SESSION", "PACKAGE", "SUBSCRIPTION"]);
const offerEligibilityEnum = z.enum(["INDIVIDUAL", "PAIR", "TEAM"]);

export const createOfferSchema = z
  .object({
    name: z.string().trim().min(2, "Il nome deve avere almeno 2 caratteri").max(80),
    description: z.string().trim().max(500).optional().nullable(),
    type: offerTypeEnum,
    priceCents: z.number().int().min(0).max(100_000_00),
    currency: z.string().trim().toUpperCase().length(3).default("EUR"),
    sessionCount: z.number().int().min(1).max(365).optional().nullable(),
    expirationDays: z.number().int().min(1).max(3650).optional().nullable(),
    sessionDurationMinutes: z.number().int().min(10).max(240).optional().nullable(),
    eligibility: offerEligibilityEnum.default("INDIVIDUAL"),
    billingFrequency: z.enum(["WEEKLY", "MONTHLY"]).optional().nullable(),
    active: z.boolean().optional(),
  })
  .refine((data) => data.type !== "SUBSCRIPTION" || Boolean(data.billingFrequency), {
    message: "Indica la frequenza di fatturazione per un abbonamento",
    path: ["billingFrequency"],
  });

export const updateOfferSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  description: z.string().trim().max(500).optional().nullable(),
  priceCents: z.number().int().min(0).max(100_000_00).optional(),
  sessionCount: z.number().int().min(1).max(365).optional().nullable(),
  expirationDays: z.number().int().min(1).max(3650).optional().nullable(),
  sessionDurationMinutes: z.number().int().min(10).max(240).optional().nullable(),
  eligibility: offerEligibilityEnum.optional(),
  active: z.boolean().optional(),
});

const paymentMethodEnum = z.enum(["ONLINE", "OFFLINE_CASH", "OFFLINE_TRANSFER", "OFFLINE_OTHER"]);

export const createPurchaseSchema = z.object({
  offerId: z.string(),
  method: paymentMethodEnum,
  markPaidNow: z.boolean().optional(),
});

export const updatePaymentStatusSchema = z.object({
  status: z.enum(["PENDING", "PAID", "PARTIALLY_PAID", "OVERDUE", "REFUNDED", "CANCELLED"]),
});

export const sessionStatusSchema = z.object({
  status: z.enum(["CANCELLED", "NO_SHOW"]),
  consumeCredit: z.boolean().optional(),
});

export const createMetricValueSchema = z.object({
  sportMetricId: z.string().min(1),
  value: z.number().finite(),
  recordedAt: z.string().datetime().optional(),
  notes: z.string().trim().max(300).optional().nullable(),
});

const checkinFeelingEnum = z.enum(["GREAT", "GOOD", "OK", "TIRED", "UNWELL"]);

export const createCheckinSchema = z
  .object({
    readiness: z.number().int().min(1).max(10).optional().nullable(),
    rpe: z.number().int().min(0).max(10).optional().nullable(),
    feeling: checkinFeelingEnum.optional().nullable(),
    sleepHours: z.number().min(0).max(24).optional().nullable(),
    soreness: z.number().int().min(1).max(10).optional().nullable(),
    notes: z.string().trim().max(500).optional().nullable(),
  })
  .refine((data) => data.readiness != null || data.rpe != null || data.feeling != null || data.sleepHours != null || data.soreness != null || Boolean(data.notes), {
    message: "Compila almeno un campo del check-in.",
  });

const injuryTypeEnum = z.enum(["INFORTUNIO", "FASTIDIO", "DOLORE_RIFERITO", "LIMITAZIONE", "PROBLEMA_RICORRENTE", "ALTRO"]);
const injurySideEnum = z.enum(["LEFT", "RIGHT", "BILATERAL", "NOT_APPLICABLE"]);
const injuryOriginEnum = z.enum(["ALLENAMENTO", "PARTITA", "COMPETIZIONE", "INSORGENZA_GRADUALE", "FUORI_DALLO_SPORT", "NON_NOTO"]);
const injuryStatusEnum = z.enum(["ACTIVE", "MONITORING", "RETURNING", "RESOLVED", "ARCHIVED"]);

export const createInjurySchema = z.object({
  type: injuryTypeEnum,
  bodyRegion: z.string().trim().min(1, "Indica l'area interessata").max(60),
  side: injurySideEnum.optional(),
  areaDetail: z.string().trim().max(100).optional().nullable(),
  origin: injuryOriginEnum.optional(),
  startDate: z.string().datetime().optional(),
  description: z.string().trim().max(1000).optional().nullable(),
  reportedLimitations: z.string().trim().max(500).optional().nullable(),
  coachNotes: z.string().trim().max(500).optional().nullable(),
});

export const updateInjurySchema = z.object({
  status: injuryStatusEnum.optional(),
  resolvedDate: z.string().datetime().optional().nullable(),
  description: z.string().trim().max(1000).optional().nullable(),
  reportedLimitations: z.string().trim().max(500).optional().nullable(),
  coachNotes: z.string().trim().max(500).optional().nullable(),
});

export const createInjuryEventSchema = z.object({
  note: z.string().trim().min(1, "Scrivi una nota").max(500),
  date: z.string().datetime().optional(),
});
