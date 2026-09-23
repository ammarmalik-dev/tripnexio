-- Step 41 (Admin FINAL handover §5): DocumentRequirement gains countryId
-- (destination GCC country, distinct from nationality) and paxType
-- (applicant/category rules), and its old (nationality, serviceType,
-- documentName) unique constraint is dropped -- nationality is now
-- nullable too, and nullable-column uniqueness semantics get messy in
-- Postgres (same reasoning PricingRule's own migration used). Additive
-- only: existing rows get countryId=NULL, paxType=NULL, which is
-- semantically "applies regardless of country/pax type" -- current
-- behavior is fully preserved, nothing is backfilled or reinterpreted.

-- DropIndex
DROP INDEX "DocumentRequirement_nationality_serviceType_documentName_key";

-- AlterTable
ALTER TABLE "DocumentRequirement" ADD COLUMN     "countryId" TEXT,
ADD COLUMN     "paxType" "PaxType",
ALTER COLUMN "nationality" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "DocumentRequirement_countryId_idx" ON "DocumentRequirement"("countryId");

-- CreateIndex
CREATE INDEX "DocumentRequirement_serviceType_countryId_nationality_idx" ON "DocumentRequirement"("serviceType", "countryId", "nationality");

-- AddForeignKey
ALTER TABLE "DocumentRequirement" ADD CONSTRAINT "DocumentRequirement_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE SET NULL ON UPDATE CASCADE;
