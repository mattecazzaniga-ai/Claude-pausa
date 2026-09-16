-- CreateTable
CREATE TABLE "AthleteMetricValue" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "sportMetricId" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AthleteMetricValue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AthleteMetricValue_athleteId_sportMetricId_idx" ON "AthleteMetricValue"("athleteId", "sportMetricId");

-- AddForeignKey
ALTER TABLE "AthleteMetricValue" ADD CONSTRAINT "AthleteMetricValue_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AthleteMetricValue" ADD CONSTRAINT "AthleteMetricValue_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AthleteMetricValue" ADD CONSTRAINT "AthleteMetricValue_sportMetricId_fkey" FOREIGN KEY ("sportMetricId") REFERENCES "SportMetric"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
