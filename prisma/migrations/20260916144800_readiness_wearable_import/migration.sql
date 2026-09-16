-- CreateEnum
CREATE TYPE "CheckinSource" AS ENUM ('SELF_REPORTED', 'WEARABLE_IMPORT');

-- AlterTable
ALTER TABLE "AthleteCheckin" ADD COLUMN     "hrv" DOUBLE PRECISION,
ADD COLUMN     "restingHeartRate" INTEGER,
ADD COLUMN     "source" "CheckinSource" NOT NULL DEFAULT 'SELF_REPORTED',
ADD COLUMN     "steps" INTEGER;
