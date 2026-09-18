-- AlterTable
ALTER TABLE "SportMetric" ADD COLUMN     "coachId" TEXT;

-- CreateIndex
CREATE INDEX "SportMetric_coachId_idx" ON "SportMetric"("coachId");

-- AddForeignKey
ALTER TABLE "SportMetric" ADD CONSTRAINT "SportMetric_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach"("id") ON DELETE SET NULL ON UPDATE CASCADE;

