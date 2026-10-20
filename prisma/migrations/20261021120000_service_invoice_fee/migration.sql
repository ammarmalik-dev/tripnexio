-- Client doc 2026-10-20 (F2/F3) — per-service invoice service fee + GST %, and the fee snapshot on each payment.
-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "invoiceServiceFee" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "gstRatePercent" DECIMAL(5,2),
ADD COLUMN     "invoiceServiceFee" DECIMAL(10,2),
ADD COLUMN     "invoiceServiceFeePerPassenger" BOOLEAN NOT NULL DEFAULT true;

