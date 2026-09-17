-- CreateEnum
CREATE TYPE "CoachPreferenceCategory" AS ENUM ('INTENSITY', 'DURATION', 'EXERCISE_STYLE', 'COMMUNICATION', 'OTHER');

-- CreateEnum
CREATE TYPE "CoachPreferenceReviewState" AS ENUM ('ACTIVE', 'CONFIRMED', 'REJECTED');

-- AlterTable
ALTER TABLE "Coach" DROP COLUMN "learnedPreferences",
DROP COLUMN "learnedPreferencesUpdatedAt",
ADD COLUMN     "coachBrainRefreshedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "CoachLearnedPreference" (
    "id" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "insight" TEXT NOT NULL,
    "category" "CoachPreferenceCategory" NOT NULL,
    "evidenceCount" INTEGER NOT NULL DEFAULT 1,
    "reviewState" "CoachPreferenceReviewState" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoachLearnedPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CoachLearnedPreference_coachId_reviewState_idx" ON "CoachLearnedPreference"("coachId", "reviewState");

-- CreateIndex
CREATE UNIQUE INDEX "CoachLearnedPreference_coachId_topic_key" ON "CoachLearnedPreference"("coachId", "topic");

-- AddForeignKey
ALTER TABLE "CoachLearnedPreference" ADD CONSTRAINT "CoachLearnedPreference_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach"("id") ON DELETE CASCADE ON UPDATE CASCADE;

