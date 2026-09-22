-- CreateEnum
CREATE TYPE "TrainingZone" AS ENUM ('WARMUP', 'EASY', 'MODERATE', 'HARD', 'RACE');

-- CreateTable
CREATE TABLE "TrainingLoadEntry" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "discipline" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "rpe" INTEGER NOT NULL,
    "zone" "TrainingZone" NOT NULL DEFAULT 'MODERATE',
    "load" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingLoadEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrainingLoadEntry_athleteId_date_idx" ON "TrainingLoadEntry"("athleteId", "date");

-- AddForeignKey
ALTER TABLE "TrainingLoadEntry" ADD CONSTRAINT "TrainingLoadEntry_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingLoadEntry" ADD CONSTRAINT "TrainingLoadEntry_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
