-- CreateEnum
CREATE TYPE "SkillCategoryType" AS ENUM ('TECHNICAL', 'TACTICAL', 'PHYSICAL', 'MENTAL', 'OTHER');

-- AlterTable
ALTER TABLE "SkillCategory" ADD COLUMN     "type" "SkillCategoryType" NOT NULL DEFAULT 'OTHER';

-- AlterTable
ALTER TABLE "Sport" ADD COLUMN     "commonProblems" TEXT,
ADD COLUMN     "gameSituations" TEXT,
ADD COLUMN     "movementPatterns" TEXT,
ADD COLUMN     "positions" TEXT,
ADD COLUMN     "progressions" TEXT,
ADD COLUMN     "safetyNotes" TEXT,
ADD COLUMN     "trainingMethods" TEXT;

-- CreateTable
CREATE TABLE "SportMetric" (
    "id" TEXT NOT NULL,
    "sportId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SportMetric_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SportMetric_sportId_idx" ON "SportMetric"("sportId");

-- AddForeignKey
ALTER TABLE "SportMetric" ADD CONSTRAINT "SportMetric_sportId_fkey" FOREIGN KEY ("sportId") REFERENCES "Sport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
