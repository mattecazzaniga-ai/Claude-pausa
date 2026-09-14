-- CreateEnum
CREATE TYPE "CoachFeedbackSignalType" AS ENUM ('RECOMMENDATION_FEEDBACK', 'SESSION_FEEDBACK', 'EXERCISE_REPLACED');

-- AlterTable
ALTER TABLE "Coach" ADD COLUMN     "learnedPreferences" JSONB,
ADD COLUMN     "learnedPreferencesUpdatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "CoachFeedbackSignal" (
    "id" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "type" "CoachFeedbackSignalType" NOT NULL,
    "summary" TEXT NOT NULL,
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoachFeedbackSignal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CoachFeedbackSignal_coachId_createdAt_idx" ON "CoachFeedbackSignal"("coachId", "createdAt");

-- AddForeignKey
ALTER TABLE "CoachFeedbackSignal" ADD CONSTRAINT "CoachFeedbackSignal_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
