/*
  Warnings:

  - You are about to drop the column `creditConsumedAt` on the `TrainingSession` table. All the data in the column will be lost.
  - You are about to drop the column `purchaseId` on the `TrainingSession` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `TrainingSession` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "CalendarEventStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- DropForeignKey
ALTER TABLE "TrainingSession" DROP CONSTRAINT "TrainingSession_purchaseId_fkey";

-- DropIndex
DROP INDEX "TrainingSession_purchaseId_idx";

-- AlterTable
ALTER TABLE "CalendarEvent" ADD COLUMN     "creditConsumedAt" TIMESTAMP(3),
ADD COLUMN     "purchaseId" TEXT,
ADD COLUMN     "status" "CalendarEventStatus" NOT NULL DEFAULT 'SCHEDULED';

-- AlterTable
ALTER TABLE "TrainingSession" DROP COLUMN "creditConsumedAt",
DROP COLUMN "purchaseId",
DROP COLUMN "status";

-- DropEnum
DROP TYPE "TrainingSessionStatus";

-- CreateIndex
CREATE INDEX "CalendarEvent_purchaseId_idx" ON "CalendarEvent"("purchaseId");

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE SET NULL ON UPDATE CASCADE;
