-- CreateEnum
CREATE TYPE "CompetitionType" AS ENUM ('TOURNAMENT', 'MATCH', 'CHAMPIONSHIP', 'LEAGUE', 'FRIENDLY', 'OTHER');

-- CreateEnum
CREATE TYPE "CompetitionResult" AS ENUM ('WIN', 'LOSS', 'DRAW', 'NOT_RECORDED');

-- CreateEnum
CREATE TYPE "CalendarEventType" AS ENUM ('TRAINING', 'EVALUATION', 'COMPETITION', 'OTHER');

-- CreateTable
CREATE TABLE "Competition" (
    "id" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "athleteId" TEXT,
    "teamId" TEXT,
    "sportId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "CompetitionType" NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "opponent" TEXT,
    "importance" TEXT,
    "preNotes" TEXT,
    "postNotes" TEXT,
    "result" "CompetitionResult" NOT NULL DEFAULT 'NOT_RECORDED',
    "score" TEXT,
    "aiPostAnalysis" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Competition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarEvent" (
    "id" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "athleteId" TEXT,
    "teamId" TEXT,
    "competitionId" TEXT,
    "trainingSessionId" TEXT,
    "type" "CalendarEventType" NOT NULL,
    "title" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Competition_coachId_idx" ON "Competition"("coachId");

-- CreateIndex
CREATE INDEX "Competition_athleteId_idx" ON "Competition"("athleteId");

-- CreateIndex
CREATE INDEX "Competition_teamId_idx" ON "Competition"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarEvent_competitionId_key" ON "CalendarEvent"("competitionId");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarEvent_trainingSessionId_key" ON "CalendarEvent"("trainingSessionId");

-- CreateIndex
CREATE INDEX "CalendarEvent_coachId_idx" ON "CalendarEvent"("coachId");

-- CreateIndex
CREATE INDEX "CalendarEvent_startAt_idx" ON "CalendarEvent"("startAt");

-- AddForeignKey
ALTER TABLE "Competition" ADD CONSTRAINT "Competition_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Competition" ADD CONSTRAINT "Competition_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Competition" ADD CONSTRAINT "Competition_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Competition" ADD CONSTRAINT "Competition_sportId_fkey" FOREIGN KEY ("sportId") REFERENCES "Sport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_trainingSessionId_fkey" FOREIGN KEY ("trainingSessionId") REFERENCES "TrainingSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
