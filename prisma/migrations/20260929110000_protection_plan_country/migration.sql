-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TaskType" ADD VALUE 'PROTECTION_PLAN_REVIEW';
ALTER TYPE "TaskType" ADD VALUE 'PROTECTION_PLAN_REFUND_REVIEW';

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "protectionPlanAmount" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ProtectionPlan" ADD COLUMN     "paymentId" TEXT,
ADD COLUMN     "refundId" TEXT;

-- CreateTable
CREATE TABLE "ProtectionPlanCountry" (
    "id" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "price" DECIMAL(10,2),
    "termsText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProtectionPlanCountry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProtectionPlanCountry_countryId_key" ON "ProtectionPlanCountry"("countryId");

-- CreateIndex
CREATE INDEX "ProtectionPlanCountry_enabled_idx" ON "ProtectionPlanCountry"("enabled");

-- CreateIndex
CREATE UNIQUE INDEX "ProtectionPlan_refundId_key" ON "ProtectionPlan"("refundId");

-- CreateIndex
CREATE INDEX "ProtectionPlan_paymentId_idx" ON "ProtectionPlan"("paymentId");

-- AddForeignKey
ALTER TABLE "ProtectionPlan" ADD CONSTRAINT "ProtectionPlan_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtectionPlan" ADD CONSTRAINT "ProtectionPlan_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "Refund"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtectionPlanCountry" ADD CONSTRAINT "ProtectionPlanCountry_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- P12 data: keep today's behaviour (the plan was offered on every New Visa
-- booking) by enabling it for every country that already has a New Visa
-- configuration. Price/terms stay empty so the global defaults apply.
-- Idempotent: only inserts countries that have no row yet.
INSERT INTO "ProtectionPlanCountry" ("id", "countryId", "enabled", "createdAt", "updatedAt")
SELECT 'ppc_' || c."id", c."id", true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Country" c
WHERE EXISTS (SELECT 1 FROM "NewVisaCountryConfig" n WHERE n."countryId" = c."id")
  AND NOT EXISTS (SELECT 1 FROM "ProtectionPlanCountry" p WHERE p."countryId" = c."id");
