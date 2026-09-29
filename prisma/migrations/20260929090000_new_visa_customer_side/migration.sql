-- CreateEnum
CREATE TYPE "NewVisaEntryKind" AS ENUM ('SINGLE', 'MULTIPLE');

-- DropIndex
DROP INDEX "NewVisaCountryConfig_countryId_key";

-- AlterTable
ALTER TABLE "PricingRule" ADD COLUMN     "newVisaConfigId" TEXT;

-- AlterTable
ALTER TABLE "NewVisaCountryConfig" ADD COLUMN     "displayOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "entryKind" "NewVisaEntryKind",
ADD COLUMN     "stayDays" INTEGER;

-- AlterTable
ALTER TABLE "ServiceTimelineConfig" ADD COLUMN     "minTravelDaysExpress" INTEGER,
ADD COLUMN     "minTravelDaysNormal" INTEGER;

-- CreateIndex
CREATE INDEX "PricingRule_newVisaConfigId_idx" ON "PricingRule"("newVisaConfigId");

-- CreateIndex
CREATE INDEX "NewVisaCountryConfig_countryId_idx" ON "NewVisaCountryConfig"("countryId");

-- AddForeignKey
ALTER TABLE "PricingRule" ADD CONSTRAINT "PricingRule_newVisaConfigId_fkey" FOREIGN KEY ("newVisaConfigId") REFERENCES "NewVisaCountryConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- P10 backfill (best effort, never overwrites): read the product dimensions
-- from each existing row's own descriptive text. Rows whose text is
-- ambiguous (e.g. "Single Entry / Multiple Entry") stay null — Admin sets
-- them at Admin → New Visa Countries.
UPDATE "NewVisaCountryConfig" SET "stayDays" = 30 WHERE "stayDays" IS NULL AND "duration" ~* '(^|[^0-9])30([^0-9]|$)' AND "duration" !~* '60';
UPDATE "NewVisaCountryConfig" SET "stayDays" = 60 WHERE "stayDays" IS NULL AND "duration" ~* '(^|[^0-9])60([^0-9]|$)' AND "duration" !~* '30';
UPDATE "NewVisaCountryConfig" SET "entryKind" = 'SINGLE' WHERE "entryKind" IS NULL AND "entryType" ~* 'single' AND "entryType" !~* 'multiple';
UPDATE "NewVisaCountryConfig" SET "entryKind" = 'MULTIPLE' WHERE "entryKind" IS NULL AND "entryType" ~* 'multiple' AND "entryType" !~* 'single';
