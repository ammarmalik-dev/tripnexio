-- Step 43 (Admin FINAL handover §7): NewVisaCountryConfig -- one row per
-- Country (same 1:1 pattern as ReturnTicketDestination), holding New-Visa-
-- specific descriptive fields (visaCategory/duration/processingType/
-- description/termsAndConditions). Deliberately does NOT duplicate
-- Pricing/Documents/Timeline data -- see the model's own schema doc comment.

-- CreateTable
CREATE TABLE "NewVisaCountryConfig" (
    "id" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "visaCategory" TEXT NOT NULL,
    "duration" TEXT NOT NULL,
    "processingType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "termsAndConditions" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewVisaCountryConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NewVisaCountryConfig_countryId_key" ON "NewVisaCountryConfig"("countryId");

-- CreateIndex
CREATE INDEX "NewVisaCountryConfig_active_idx" ON "NewVisaCountryConfig"("active");

-- AddForeignKey
ALTER TABLE "NewVisaCountryConfig" ADD CONSTRAINT "NewVisaCountryConfig_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
