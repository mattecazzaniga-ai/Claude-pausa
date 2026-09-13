-- CreateEnum
CREATE TYPE "Sentiment" AS ENUM ('POSITIVE', 'NEGATIVE', 'NEUTRAL', 'IMPROVING');

-- CreateTable
CREATE TABLE "Coach" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Coach_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sport" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Sport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillCategory" (
    "id" TEXT NOT NULL,
    "sportId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SkillCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Skill" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Athlete" (
    "id" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "sportId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "birthYear" INTEGER,
    "level" TEXT,
    "objectives" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "aiSummary" TEXT,
    "aiPriorities" JSONB,
    "aiSummaryUpdatedAt" TIMESTAMP(3),

    CONSTRAINT "Athlete_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionNote" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "sessionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rawText" TEXT NOT NULL,
    "aiProcessed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoteTag" (
    "id" TEXT NOT NULL,
    "sessionNoteId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "sentiment" "Sentiment" NOT NULL,
    "excerpt" TEXT NOT NULL,

    CONSTRAINT "NoteTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "coachId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Coach_email_key" ON "Coach"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Sport_slug_key" ON "Sport"("slug");

-- CreateIndex
CREATE INDEX "SkillCategory_sportId_idx" ON "SkillCategory"("sportId");

-- CreateIndex
CREATE INDEX "Skill_categoryId_idx" ON "Skill"("categoryId");

-- CreateIndex
CREATE INDEX "Athlete_coachId_idx" ON "Athlete"("coachId");

-- CreateIndex
CREATE INDEX "SessionNote_athleteId_idx" ON "SessionNote"("athleteId");

-- CreateIndex
CREATE INDEX "NoteTag_sessionNoteId_idx" ON "NoteTag"("sessionNoteId");

-- CreateIndex
CREATE INDEX "NoteTag_skillId_idx" ON "NoteTag"("skillId");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_name_idx" ON "AnalyticsEvent"("name");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_createdAt_idx" ON "AnalyticsEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "SkillCategory" ADD CONSTRAINT "SkillCategory_sportId_fkey" FOREIGN KEY ("sportId") REFERENCES "Sport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "SkillCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Athlete" ADD CONSTRAINT "Athlete_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Athlete" ADD CONSTRAINT "Athlete_sportId_fkey" FOREIGN KEY ("sportId") REFERENCES "Sport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionNote" ADD CONSTRAINT "SessionNote_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionNote" ADD CONSTRAINT "SessionNote_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteTag" ADD CONSTRAINT "NoteTag_sessionNoteId_fkey" FOREIGN KEY ("sessionNoteId") REFERENCES "SessionNote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteTag" ADD CONSTRAINT "NoteTag_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach"("id") ON DELETE SET NULL ON UPDATE CASCADE;
