-- Client doc 2026-10-27 (E2) — New Visa vendor rates per visa option / type (NewVisaCountryConfig); null = any.
ALTER TABLE "VendorServiceRate" ADD COLUMN "newVisaConfigId" TEXT;

ALTER TABLE "VendorServiceRate" ADD CONSTRAINT "VendorServiceRate_newVisaConfigId_fkey" FOREIGN KEY ("newVisaConfigId") REFERENCES "NewVisaCountryConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;
