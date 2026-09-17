-- CreateEnum
CREATE TYPE "TrainingPhase" AS ENUM ('CARICO', 'SCARICO', 'MANTENIMENTO');

-- CreateEnum
CREATE TYPE "PlannedSessionIntensity" AS ENUM ('ALTA', 'MEDIA', 'BASSA');

-- AlterTable
ALTER TABLE "Athlete" ADD COLUMN     "trainingDaysPerWeek" INTEGER;

-- AlterTable
ALTER TABLE "Sport" ADD COLUMN     "disciplines" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "trainingDaysPerWeek" INTEGER;

-- CreateTable
CREATE TABLE "WeeklyTrainingPlan" (
    "id" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "athleteId" TEXT,
    "teamId" TEXT,
    "weekStartDate" TIMESTAMP(3) NOT NULL,
    "sessionsPerWeek" INTEGER NOT NULL,
    "phase" "TrainingPhase" NOT NULL,
    "rationale" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeeklyTrainingPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlannedSessionSlot" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "intensity" "PlannedSessionIntensity" NOT NULL,
    "discipline" TEXT,
    "focus" TEXT NOT NULL,
    "trainingSessionId" TEXT,

    CONSTRAINT "PlannedSessionSlot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WeeklyTrainingPlan_coachId_idx" ON "WeeklyTrainingPlan"("coachId");

-- CreateIndex
CREATE INDEX "WeeklyTrainingPlan_athleteId_idx" ON "WeeklyTrainingPlan"("athleteId");

-- CreateIndex
CREATE INDEX "WeeklyTrainingPlan_teamId_idx" ON "WeeklyTrainingPlan"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "PlannedSessionSlot_trainingSessionId_key" ON "PlannedSessionSlot"("trainingSessionId");

-- CreateIndex
CREATE INDEX "PlannedSessionSlot_planId_idx" ON "PlannedSessionSlot"("planId");

-- AddForeignKey
ALTER TABLE "WeeklyTrainingPlan" ADD CONSTRAINT "WeeklyTrainingPlan_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyTrainingPlan" ADD CONSTRAINT "WeeklyTrainingPlan_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyTrainingPlan" ADD CONSTRAINT "WeeklyTrainingPlan_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedSessionSlot" ADD CONSTRAINT "PlannedSessionSlot_planId_fkey" FOREIGN KEY ("planId") REFERENCES "WeeklyTrainingPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedSessionSlot" ADD CONSTRAINT "PlannedSessionSlot_trainingSessionId_fkey" FOREIGN KEY ("trainingSessionId") REFERENCES "TrainingSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
