-- Client doc 2026-10-14 — Special Fare quote: vendor cost per Adult / Child / Infant (internal only).
-- AlterTable
ALTER TABLE "Quotation" ADD COLUMN     "adultVendorCost" DECIMAL(10,2),
ADD COLUMN     "childVendorCost" DECIMAL(10,2),
ADD COLUMN     "infantVendorCost" DECIMAL(10,2);

