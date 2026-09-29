-- AlterTable
ALTER TABLE "VendorService" ADD COLUMN     "cost" DECIMAL(10,2),
ADD COLUMN     "rate" DECIMAL(10,2),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "validFrom" TIMESTAMP(3),
ADD COLUMN     "validUntil" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Country" ADD COLUMN     "flagOverride" TEXT;

-- AlterTable
ALTER TABLE "PricingRule" ADD COLUMN     "subServiceId" TEXT,
ADD COLUMN     "visaTypeId" TEXT;

-- CreateTable
CREATE TABLE "SubService" (
    "id" TEXT NOT NULL,
    "serviceType" "ServiceType" NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessingTypeOption" (
    "id" TEXT NOT NULL,
    "serviceType" "ServiceType" NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcessingTypeOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PricingRuleHistory" (
    "id" TEXT NOT NULL,
    "pricingRuleId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "oldValues" JSONB,
    "newValues" JSONB NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PricingRuleHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorRateHistory" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "service" "ServiceType" NOT NULL,
    "oldValues" JSONB,
    "newValues" JSONB NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorRateHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SubService_serviceType_active_idx" ON "SubService"("serviceType", "active");

-- CreateIndex
CREATE UNIQUE INDEX "SubService_serviceType_code_key" ON "SubService"("serviceType", "code");

-- CreateIndex
CREATE INDEX "ProcessingTypeOption_serviceType_active_idx" ON "ProcessingTypeOption"("serviceType", "active");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessingTypeOption_serviceType_code_key" ON "ProcessingTypeOption"("serviceType", "code");

-- CreateIndex
CREATE INDEX "PricingRuleHistory_pricingRuleId_createdAt_idx" ON "PricingRuleHistory"("pricingRuleId", "createdAt");

-- CreateIndex
CREATE INDEX "VendorRateHistory_vendorId_service_createdAt_idx" ON "VendorRateHistory"("vendorId", "service", "createdAt");

-- CreateIndex
CREATE INDEX "PricingRule_subServiceId_idx" ON "PricingRule"("subServiceId");

-- CreateIndex
CREATE INDEX "PricingRule_visaTypeId_idx" ON "PricingRule"("visaTypeId");

-- AddForeignKey
ALTER TABLE "PricingRule" ADD CONSTRAINT "PricingRule_subServiceId_fkey" FOREIGN KEY ("subServiceId") REFERENCES "SubService"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PricingRule" ADD CONSTRAINT "PricingRule_visaTypeId_fkey" FOREIGN KEY ("visaTypeId") REFERENCES "VisaType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PricingRuleHistory" ADD CONSTRAINT "PricingRuleHistory_pricingRuleId_fkey" FOREIGN KEY ("pricingRuleId") REFERENCES "PricingRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- P23: the processing options that were hard-coded in the forms, now Admin
-- master rows (codes unchanged, so existing leads/pricing keep matching).
INSERT INTO "ProcessingTypeOption" ("id", "serviceType", "code", "label", "description", "active", "displayOrder", "createdAt", "updatedAt")
VALUES
  ('pto_new_visa_normal', 'NEW_VISA', 'normal', 'Normal', NULL, true, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('pto_new_visa_urgent', 'NEW_VISA', 'urgent', 'Express', NULL, true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('pto_otb_normal', 'OTB', 'normal', 'Normal', NULL, true, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('pto_otb_urgent', 'OTB', 'urgent', 'Urgent', NULL, true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "code") DO NOTHING;
