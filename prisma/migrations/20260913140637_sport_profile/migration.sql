-- CreateEnum
CREATE TYPE "SportFormat" AS ENUM ('INDIVIDUAL', 'PAIR', 'TEAM');

-- AlterTable
ALTER TABLE "Sport" ADD COLUMN     "environment" TEXT,
ADD COLUMN     "equipment" TEXT,
ADD COLUMN     "formats" "SportFormat"[],
ADD COLUMN     "keyRules" TEXT,
ADD COLUMN     "profileGeneratedAt" TIMESTAMP(3),
ADD COLUMN     "scoringSystem" TEXT,
ADD COLUMN     "terminology" TEXT;
