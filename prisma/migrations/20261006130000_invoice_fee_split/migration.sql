-- Client corrections 2026-10-05: invoices show the government / airline fee apart from
-- TripNexio's service fee (and exclude it from GST). Defaults 0 = all service fee, so
-- existing prices and invoices are unchanged until Admin enters the fee split.

-- AlterTable
ALTER TABLE "OtbPrice" ADD COLUMN     "airlineFee" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "PricingRule" ADD COLUMN     "governmentFee" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Quotation" ADD COLUMN     "governmentFee" DECIMAL(10,2),
ADD COLUMN     "invoiceLines" JSONB;

-- AlterTable
ALTER TABLE "ReturnTicketDestination" ADD COLUMN     "airlineFeePerApplicant" DECIMAL(10,2) NOT NULL DEFAULT 0;

