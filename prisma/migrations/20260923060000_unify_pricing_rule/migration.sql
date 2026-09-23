-- Step 40 (Admin FINAL handover §4): PricingRule becomes the real central
-- pricing control -- "Use the existing Pricing module as the central
-- pricing control." NewVisaPricing is retired and its data migrated in
-- (one PricingRule row per paxType per existing NewVisaPricing row).
-- basePrice is RENAMED to sellingPrice (not dropped+recreated) so the 3
-- existing sample PricingRule rows keep their data.

-- AlterTable: rename basePrice -> sellingPrice (preserves existing data).
ALTER TABLE "PricingRule" RENAME COLUMN "basePrice" TO "sellingPrice";

-- AlterTable: new columns.
ALTER TABLE "PricingRule"
  ADD COLUMN     "countryId" TEXT,
  ADD COLUMN     "processingType" TEXT,
  ADD COLUMN     "validityFrom" TIMESTAMP(3),
  ADD COLUMN     "validityUntil" TIMESTAMP(3),
  ADD COLUMN     "vendorCost" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- Data migration: every existing NewVisaPricing row becomes 3 PricingRule
-- rows (ADULT/CHILD/INFANT), before the source table is dropped.
INSERT INTO "PricingRule" ("id", "serviceType", "countryId", "processingType", "paxType", "nationality", "vendorCost", "sellingPrice", "additionalCharges", "active", "createdAt", "updatedAt")
SELECT 'prule_' || substr(md5(random()::text || clock_timestamp()::text || "id" || 'A'), 1, 20),
       'NEW_VISA'::"ServiceType", "countryId", "processingType", 'ADULT'::"PaxType", NULL, 0, "adultPrice", 0, "active", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "NewVisaPricing"
UNION ALL
SELECT 'prule_' || substr(md5(random()::text || clock_timestamp()::text || "id" || 'C'), 1, 20),
       'NEW_VISA'::"ServiceType", "countryId", "processingType", 'CHILD'::"PaxType", NULL, 0, "childPrice", 0, "active", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "NewVisaPricing"
UNION ALL
SELECT 'prule_' || substr(md5(random()::text || clock_timestamp()::text || "id" || 'I'), 1, 20),
       'NEW_VISA'::"ServiceType", "countryId", "processingType", 'INFANT'::"PaxType", NULL, 0, "infantPrice", 0, "active", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "NewVisaPricing";

-- DropForeignKey (NewVisaPricing's own FK, before dropping the table).
ALTER TABLE "NewVisaPricing" DROP CONSTRAINT "NewVisaPricing_countryId_fkey";

-- DropTable
DROP TABLE "NewVisaPricing";

-- CreateIndex
CREATE INDEX "PricingRule_countryId_idx" ON "PricingRule"("countryId");
CREATE INDEX "PricingRule_serviceType_countryId_processingType_idx" ON "PricingRule"("serviceType", "countryId", "processingType");

-- AddForeignKey
ALTER TABLE "PricingRule" ADD CONSTRAINT "PricingRule_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE SET NULL ON UPDATE CASCADE;
