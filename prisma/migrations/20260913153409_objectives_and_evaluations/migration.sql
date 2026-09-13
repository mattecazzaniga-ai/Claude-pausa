-- CreateEnum
CREATE TYPE "ObjectiveTermLength" AS ENUM ('SHORT', 'MEDIUM', 'LONG');

-- CreateEnum
CREATE TYPE "ObjectiveKind" AS ENUM ('QUANTITATIVE', 'QUALITATIVE');

-- CreateEnum
CREATE TYPE "ObjectiveStatus" AS ENUM ('ACTIVE', 'ACHIEVED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "EvaluationScoreType" AS ENUM ('SCALE_1_5', 'SCALE_1_10', 'PERCENTAGE', 'TIME_SECONDS', 'DISTANCE_METERS', 'REPETITIONS', 'SUCCESS_RATE', 'CUSTOM_NUMERIC', 'QUALITATIVE');

-- CreateEnum
CREATE TYPE "EvaluationKind" AS ENUM ('INITIAL', 'PERIODIC');

-- CreateTable
CREATE TABLE "Objective" (
    "id" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "athleteId" TEXT,
    "teamId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "termLength" "ObjectiveTermLength" NOT NULL,
    "kind" "ObjectiveKind" NOT NULL,
    "baselineValue" TEXT,
    "targetValue" TEXT,
    "currentValue" TEXT,
    "unit" TEXT,
    "deadline" TIMESTAMP(3),
    "status" "ObjectiveStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Objective_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvaluationCriterion" (
    "id" TEXT NOT NULL,
    "sportId" TEXT NOT NULL,
    "coachId" TEXT,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scoreType" "EvaluationScoreType" NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "targetLevel" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvaluationCriterion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evaluation" (
    "id" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "athleteId" TEXT,
    "teamId" TEXT,
    "kind" "EvaluationKind" NOT NULL,
    "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "aiAnalysis" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Evaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvaluationScore" (
    "id" TEXT NOT NULL,
    "evaluationId" TEXT NOT NULL,
    "criterionId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "note" TEXT,

    CONSTRAINT "EvaluationScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Objective_coachId_idx" ON "Objective"("coachId");

-- CreateIndex
CREATE INDEX "Objective_athleteId_idx" ON "Objective"("athleteId");

-- CreateIndex
CREATE INDEX "Objective_teamId_idx" ON "Objective"("teamId");

-- CreateIndex
CREATE INDEX "EvaluationCriterion_sportId_idx" ON "EvaluationCriterion"("sportId");

-- CreateIndex
CREATE INDEX "EvaluationCriterion_coachId_idx" ON "EvaluationCriterion"("coachId");

-- CreateIndex
CREATE INDEX "Evaluation_athleteId_idx" ON "Evaluation"("athleteId");

-- CreateIndex
CREATE INDEX "Evaluation_teamId_idx" ON "Evaluation"("teamId");

-- CreateIndex
CREATE INDEX "Evaluation_coachId_idx" ON "Evaluation"("coachId");

-- CreateIndex
CREATE INDEX "EvaluationScore_criterionId_idx" ON "EvaluationScore"("criterionId");

-- CreateIndex
CREATE UNIQUE INDEX "EvaluationScore_evaluationId_criterionId_key" ON "EvaluationScore"("evaluationId", "criterionId");

-- AddForeignKey
ALTER TABLE "Objective" ADD CONSTRAINT "Objective_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Objective" ADD CONSTRAINT "Objective_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Objective" ADD CONSTRAINT "Objective_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationCriterion" ADD CONSTRAINT "EvaluationCriterion_sportId_fkey" FOREIGN KEY ("sportId") REFERENCES "Sport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationCriterion" ADD CONSTRAINT "EvaluationCriterion_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationScore" ADD CONSTRAINT "EvaluationScore_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "Evaluation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationScore" ADD CONSTRAINT "EvaluationScore_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES "EvaluationCriterion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
