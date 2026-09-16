-- CreateEnum
CREATE TYPE "CheckinFeeling" AS ENUM ('GREAT', 'GOOD', 'OK', 'TIRED', 'UNWELL');

-- AlterTable
ALTER TABLE "Athlete" ADD COLUMN     "isSelf" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Coach" ADD COLUMN     "selfCoaching" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "AthleteCheckin" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readiness" INTEGER,
    "rpe" INTEGER,
    "feeling" "CheckinFeeling",
    "sleepHours" DOUBLE PRECISION,
    "soreness" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AthleteCheckin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AthleteCheckin_athleteId_date_idx" ON "AthleteCheckin"("athleteId", "date");

-- AddForeignKey
ALTER TABLE "AthleteCheckin" ADD CONSTRAINT "AthleteCheckin_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AthleteCheckin" ADD CONSTRAINT "AthleteCheckin_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
