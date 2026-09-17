-- CreateEnum
CREATE TYPE "InjuryType" AS ENUM ('INFORTUNIO', 'FASTIDIO', 'DOLORE_RIFERITO', 'LIMITAZIONE', 'PROBLEMA_RICORRENTE', 'ALTRO');

-- CreateEnum
CREATE TYPE "InjurySide" AS ENUM ('LEFT', 'RIGHT', 'BILATERAL', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "InjuryOrigin" AS ENUM ('ALLENAMENTO', 'PARTITA', 'COMPETIZIONE', 'INSORGENZA_GRADUALE', 'FUORI_DALLO_SPORT', 'NON_NOTO');

-- CreateEnum
CREATE TYPE "InjuryStatus" AS ENUM ('ACTIVE', 'MONITORING', 'RETURNING', 'RESOLVED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "AthleteInjury" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "type" "InjuryType" NOT NULL,
    "bodyRegion" TEXT NOT NULL,
    "side" "InjurySide" NOT NULL DEFAULT 'NOT_APPLICABLE',
    "areaDetail" TEXT,
    "origin" "InjuryOrigin" NOT NULL DEFAULT 'NON_NOTO',
    "status" "InjuryStatus" NOT NULL DEFAULT 'ACTIVE',
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedDate" TIMESTAMP(3),
    "description" TEXT,
    "reportedLimitations" TEXT,
    "coachNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AthleteInjury_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AthleteInjuryEvent" (
    "id" TEXT NOT NULL,
    "injuryId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AthleteInjuryEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AthleteInjury_athleteId_status_idx" ON "AthleteInjury"("athleteId", "status");

-- CreateIndex
CREATE INDEX "AthleteInjuryEvent_injuryId_idx" ON "AthleteInjuryEvent"("injuryId");

-- AddForeignKey
ALTER TABLE "AthleteInjury" ADD CONSTRAINT "AthleteInjury_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AthleteInjury" ADD CONSTRAINT "AthleteInjury_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AthleteInjuryEvent" ADD CONSTRAINT "AthleteInjuryEvent_injuryId_fkey" FOREIGN KEY ("injuryId") REFERENCES "AthleteInjury"("id") ON DELETE CASCADE ON UPDATE CASCADE;
