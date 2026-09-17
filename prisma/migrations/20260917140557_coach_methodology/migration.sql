-- CreateEnum
CREATE TYPE "MethodologyPrincipleCategory" AS ENUM ('FILOSOFIA', 'VOLUME', 'INTENSITA', 'RECUPERO', 'PROGRESSIONE', 'REGRESSIONE', 'PERIODIZZAZIONE', 'SCELTA_ESERCIZI', 'ESERCIZI_PREFERITI', 'ESERCIZI_DA_EVITARE', 'PRE_COMPETIZIONE', 'POST_COMPETIZIONE', 'LIVELLI_ETA', 'REGOLE_SPORT_SPECIFICHE', 'ALTRO');

-- AlterTable
ALTER TABLE "TrainingSession" ADD COLUMN     "methodologyVersion" INTEGER;

-- CreateTable
CREATE TABLE "CoachMethodologyPrinciple" (
    "id" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "category" "MethodologyPrincipleCategory" NOT NULL DEFAULT 'ALTRO',
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoachMethodologyPrinciple_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoachMethodologyVersion" (
    "id" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "principles" JSONB NOT NULL,
    "changeSummary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoachMethodologyVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CoachMethodologyPrinciple_coachId_idx" ON "CoachMethodologyPrinciple"("coachId");

-- CreateIndex
CREATE INDEX "CoachMethodologyVersion_coachId_idx" ON "CoachMethodologyVersion"("coachId");

-- CreateIndex
CREATE UNIQUE INDEX "CoachMethodologyVersion_coachId_version_key" ON "CoachMethodologyVersion"("coachId", "version");

-- AddForeignKey
ALTER TABLE "CoachMethodologyPrinciple" ADD CONSTRAINT "CoachMethodologyPrinciple_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachMethodologyVersion" ADD CONSTRAINT "CoachMethodologyVersion_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
