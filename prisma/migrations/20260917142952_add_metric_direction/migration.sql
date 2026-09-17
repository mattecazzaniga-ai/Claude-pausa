-- CreateEnum
CREATE TYPE "MetricDirection" AS ENUM ('HIGHER_IS_BETTER', 'LOWER_IS_BETTER');

-- AlterTable
ALTER TABLE "SportMetric" ADD COLUMN     "direction" "MetricDirection";
