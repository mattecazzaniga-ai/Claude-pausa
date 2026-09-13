-- CreateEnum
CREATE TYPE "ExerciseCategory" AS ENUM ('TECHNICAL', 'TACTICAL', 'PHYSICAL', 'COGNITIVE', 'WARMUP', 'COOLDOWN', 'COMPETITIVE');

-- CreateEnum
CREATE TYPE "ExerciseFormat" AS ENUM ('INDIVIDUAL', 'PAIR', 'SMALL_GROUP', 'TEAM', 'GAME');

-- CreateEnum
CREATE TYPE "ExerciseDifficulty" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'ELITE');

-- CreateEnum
CREATE TYPE "ExerciseSource" AS ENUM ('COACH_CREATED', 'AI_GENERATED');

-- CreateEnum
CREATE TYPE "SessionBlockType" AS ENUM ('WARMUP', 'TECHNICAL', 'TACTICAL', 'PHYSICAL', 'GAME', 'COOLDOWN');

-- AlterTable
ALTER TABLE "Coach" ADD COLUMN     "primarySportId" TEXT;

-- CreateTable
CREATE TABLE "Exercise" (
    "id" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "sportId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "instructions" TEXT,
    "category" "ExerciseCategory" NOT NULL,
    "format" "ExerciseFormat",
    "difficulty" "ExerciseDifficulty",
    "durationMinutes" INTEGER,
    "sets" INTEGER,
    "reps" INTEGER,
    "restSeconds" INTEGER,
    "intensity" TEXT,
    "equipment" TEXT,
    "minAthletes" INTEGER,
    "maxAthletes" INTEGER,
    "spaceRequired" TEXT,
    "coachingPoints" TEXT,
    "commonMistakes" TEXT,
    "progressionNote" TEXT,
    "regressionNote" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "source" "ExerciseSource" NOT NULL DEFAULT 'COACH_CREATED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Exercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExerciseSkill" (
    "id" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,

    CONSTRAINT "ExerciseSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingSession" (
    "id" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "objective" TEXT,
    "durationMinutes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sportId" TEXT,

    CONSTRAINT "TrainingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionBlock" (
    "id" TEXT NOT NULL,
    "trainingSessionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "type" "SessionBlockType" NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "exerciseId" TEXT,
    "rationale" TEXT,

    CONSTRAINT "SessionBlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Exercise_coachId_idx" ON "Exercise"("coachId");

-- CreateIndex
CREATE INDEX "Exercise_sportId_idx" ON "Exercise"("sportId");

-- CreateIndex
CREATE INDEX "ExerciseSkill_skillId_idx" ON "ExerciseSkill"("skillId");

-- CreateIndex
CREATE UNIQUE INDEX "ExerciseSkill_exerciseId_skillId_key" ON "ExerciseSkill"("exerciseId", "skillId");

-- CreateIndex
CREATE INDEX "TrainingSession_athleteId_idx" ON "TrainingSession"("athleteId");

-- CreateIndex
CREATE INDEX "TrainingSession_coachId_idx" ON "TrainingSession"("coachId");

-- CreateIndex
CREATE INDEX "SessionBlock_trainingSessionId_idx" ON "SessionBlock"("trainingSessionId");

-- AddForeignKey
ALTER TABLE "Coach" ADD CONSTRAINT "Coach_primarySportId_fkey" FOREIGN KEY ("primarySportId") REFERENCES "Sport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exercise" ADD CONSTRAINT "Exercise_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exercise" ADD CONSTRAINT "Exercise_sportId_fkey" FOREIGN KEY ("sportId") REFERENCES "Sport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseSkill" ADD CONSTRAINT "ExerciseSkill_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseSkill" ADD CONSTRAINT "ExerciseSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_sportId_fkey" FOREIGN KEY ("sportId") REFERENCES "Sport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionBlock" ADD CONSTRAINT "SessionBlock_trainingSessionId_fkey" FOREIGN KEY ("trainingSessionId") REFERENCES "TrainingSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionBlock" ADD CONSTRAINT "SessionBlock_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE SET NULL ON UPDATE CASCADE;
