-- Client doc 2026-10-15 — New Visa vendor cost by country, nationality, passenger type and processing type.
ALTER TABLE "VendorServiceRate" ADD COLUMN "nationalityId" TEXT;
ALTER TABLE "VendorServiceRate" ADD COLUMN "paxType" "PaxType";

ALTER TABLE "VendorServiceRate" ADD CONSTRAINT "VendorServiceRate_nationalityId_fkey" FOREIGN KEY ("nationalityId") REFERENCES "Nationality"("id") ON DELETE SET NULL ON UPDATE CASCADE;
