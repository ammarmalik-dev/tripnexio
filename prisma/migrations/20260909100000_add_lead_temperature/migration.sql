-- Step 12 (client-locked-spec DEVELOPMENT_ROADMAP.md, audit §3.1):
-- CRM.md §5, locked: "Lead temperature: Cold, Warm, Hot." Nullable — no
-- default at intake, staff-set only.

-- CreateEnum
CREATE TYPE "LeadTemperature" AS ENUM ('COLD', 'WARM', 'HOT');

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN "temperature" "LeadTemperature";

-- CreateIndex
CREATE INDEX "Lead_temperature_idx" ON "Lead"("temperature");
