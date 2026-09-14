-- CreateEnum
CREATE TYPE "CoachingActionType" AS ENUM ('TRAIN_SKILL', 'CHANGE_EXERCISE', 'PROGRESS_EXERCISE', 'REGRESS_EXERCISE', 'CHANGE_SESSION_STRUCTURE', 'CHANGE_INTENSITY', 'REASSESS', 'CREATE_OBJECTIVE', 'PREPARE_COMPETITION', 'REVIEW_COMPETITION', 'CHANGE_PRIORITY', 'MAINTAIN_CURRENT_FOCUS');

-- CreateEnum
CREATE TYPE "RecommendationConfidence" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "RecommendationFeedback" AS ENUM ('USEFUL', 'NOT_USEFUL');

-- CreateTable
CREATE TABLE "CoachingRecommendation" (
    "id" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "athleteId" TEXT,
    "teamId" TEXT,
    "actionType" "CoachingActionType" NOT NULL,
    "priorityLabel" TEXT NOT NULL,
    "facts" JSONB NOT NULL,
    "pattern" TEXT NOT NULL,
    "recommendation" TEXT NOT NULL,
    "confidence" "RecommendationConfidence" NOT NULL,
    "missingData" JSONB,
    "suggestedObjective" TEXT,
    "suggestedDurationMinutes" INTEGER,
    "feedback" "RecommendationFeedback",
    "feedbackReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoachingRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CoachingRecommendation_coachId_idx" ON "CoachingRecommendation"("coachId");

-- CreateIndex
CREATE INDEX "CoachingRecommendation_athleteId_idx" ON "CoachingRecommendation"("athleteId");

-- CreateIndex
CREATE INDEX "CoachingRecommendation_teamId_idx" ON "CoachingRecommendation"("teamId");

-- AddForeignKey
ALTER TABLE "CoachingRecommendation" ADD CONSTRAINT "CoachingRecommendation_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachingRecommendation" ADD CONSTRAINT "CoachingRecommendation_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachingRecommendation" ADD CONSTRAINT "CoachingRecommendation_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
