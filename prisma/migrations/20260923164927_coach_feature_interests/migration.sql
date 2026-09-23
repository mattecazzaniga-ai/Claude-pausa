-- AlterTable
ALTER TABLE "Coach" ADD COLUMN     "interestedFeatures" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "featuresOnboardedAt" TIMESTAMP(3);
