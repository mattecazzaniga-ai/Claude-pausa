-- CreateEnum
CREATE TYPE "MemoryStatus" AS ENUM ('TEMPORANEA', 'RILEVANTE', 'PERSISTENTE', 'STORICA');

-- CreateEnum
CREATE TYPE "MemoryConfidence" AS ENUM ('FACT', 'PATTERN', 'PREFERENCE', 'CONFIRMED');

-- CreateEnum
CREATE TYPE "MemorySource" AS ENUM ('SESSION_NOTE', 'SESSION_FEEDBACK', 'EVALUATION', 'COMPETITION', 'CHECKIN', 'COACH_OBSERVATION', 'MANUAL');

-- CreateEnum
CREATE TYPE "MemoryReviewState" AS ENUM ('ACTIVE', 'REJECTED');

-- CreateTable
CREATE TABLE "AthleteMemory" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "topic" TEXT,
    "summary" TEXT NOT NULL,
    "status" "MemoryStatus" NOT NULL DEFAULT 'RILEVANTE',
    "confidence" "MemoryConfidence" NOT NULL DEFAULT 'FACT',
    "source" "MemorySource" NOT NULL,
    "reviewState" "MemoryReviewState" NOT NULL DEFAULT 'ACTIVE',
    "evidenceCount" INTEGER NOT NULL DEFAULT 1,
    "firstObservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastObservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AthleteMemory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AthleteMemoryEvent" (
    "id" TEXT NOT NULL,
    "memoryId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AthleteMemoryEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMemory" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "topic" TEXT,
    "summary" TEXT NOT NULL,
    "status" "MemoryStatus" NOT NULL DEFAULT 'RILEVANTE',
    "confidence" "MemoryConfidence" NOT NULL DEFAULT 'FACT',
    "source" "MemorySource" NOT NULL,
    "reviewState" "MemoryReviewState" NOT NULL DEFAULT 'ACTIVE',
    "evidenceCount" INTEGER NOT NULL DEFAULT 1,
    "firstObservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastObservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamMemory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMemoryEvent" (
    "id" TEXT NOT NULL,
    "memoryId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamMemoryEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AthleteMemory_athleteId_status_idx" ON "AthleteMemory"("athleteId", "status");

-- CreateIndex
CREATE INDEX "AthleteMemory_athleteId_topic_idx" ON "AthleteMemory"("athleteId", "topic");

-- CreateIndex
CREATE INDEX "AthleteMemory_coachId_idx" ON "AthleteMemory"("coachId");

-- CreateIndex
CREATE INDEX "AthleteMemoryEvent_memoryId_idx" ON "AthleteMemoryEvent"("memoryId");

-- CreateIndex
CREATE INDEX "TeamMemory_teamId_status_idx" ON "TeamMemory"("teamId", "status");

-- CreateIndex
CREATE INDEX "TeamMemory_teamId_topic_idx" ON "TeamMemory"("teamId", "topic");

-- CreateIndex
CREATE INDEX "TeamMemory_coachId_idx" ON "TeamMemory"("coachId");

-- CreateIndex
CREATE INDEX "TeamMemoryEvent_memoryId_idx" ON "TeamMemoryEvent"("memoryId");

-- AddForeignKey
ALTER TABLE "AthleteMemory" ADD CONSTRAINT "AthleteMemory_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AthleteMemory" ADD CONSTRAINT "AthleteMemory_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AthleteMemoryEvent" ADD CONSTRAINT "AthleteMemoryEvent_memoryId_fkey" FOREIGN KEY ("memoryId") REFERENCES "AthleteMemory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMemory" ADD CONSTRAINT "TeamMemory_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMemory" ADD CONSTRAINT "TeamMemory_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMemoryEvent" ADD CONSTRAINT "TeamMemoryEvent_memoryId_fkey" FOREIGN KEY ("memoryId") REFERENCES "TeamMemory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
