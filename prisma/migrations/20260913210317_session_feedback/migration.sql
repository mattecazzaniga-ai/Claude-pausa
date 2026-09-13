-- CreateEnum
CREATE TYPE "SessionFeedbackRating" AS ENUM ('EXCELLENT', 'GOOD', 'AVERAGE', 'NEEDS_WORK');

-- AlterTable
ALTER TABLE "TrainingSession" ADD COLUMN     "feedbackNote" TEXT,
ADD COLUMN     "feedbackRating" "SessionFeedbackRating";
