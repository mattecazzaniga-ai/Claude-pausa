-- AlterTable
ALTER TABLE "CoachFeedbackSignal" ADD COLUMN     "athleteId" TEXT,
ADD COLUMN     "teamId" TEXT;

-- CreateIndex
CREATE INDEX "CoachFeedbackSignal_athleteId_idx" ON "CoachFeedbackSignal"("athleteId");

-- CreateIndex
CREATE INDEX "CoachFeedbackSignal_teamId_idx" ON "CoachFeedbackSignal"("teamId");

-- AddForeignKey
ALTER TABLE "CoachFeedbackSignal" ADD CONSTRAINT "CoachFeedbackSignal_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachFeedbackSignal" ADD CONSTRAINT "CoachFeedbackSignal_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
