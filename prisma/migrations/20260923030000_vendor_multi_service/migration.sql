-- Step 36 (Admin FINAL handover §12 — Vendor Management):
-- "One vendor can be linked to multiple services and sub-services... Store
-- vendor cost/rate/performance service-wise without creating duplicate
-- vendor records." Replaces Vendor's single `service` column with a
-- VendorService join table, and adds the profile fields the handover asks
-- for (POC, mobile, email, GST/tax, account/payment details, processing
-- details, availability). Vendor cost/rate stays trackable service-wise
-- through each Quotation's own vendorCost (already scoped to its Lead's
-- serviceType) -- no cost field is added here, to avoid a second source of
-- truth for the same number.

-- CreateTable
CREATE TABLE "VendorService" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "service" "ServiceType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorService_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VendorService_vendorId_service_key" ON "VendorService"("vendorId", "service");
CREATE INDEX "VendorService_service_idx" ON "VendorService"("service");

ALTER TABLE "VendorService" ADD CONSTRAINT "VendorService_vendorId_fkey"
  FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: one VendorService row per existing Vendor, from its old single service.
INSERT INTO "VendorService" ("id", "vendorId", "service", "createdAt")
SELECT 'vsvc_' || substr(md5(random()::text || clock_timestamp()::text || "id"), 1, 24), "id", "service", CURRENT_TIMESTAMP
FROM "Vendor";

-- DropIndex
DROP INDEX "Vendor_service_idx";

-- AlterTable
ALTER TABLE "Vendor" DROP COLUMN "service",
  ADD COLUMN "mobile" TEXT,
  ADD COLUMN "email" TEXT,
  ADD COLUMN "pocName" TEXT,
  ADD COLUMN "processingDetails" TEXT,
  ADD COLUMN "availability" TEXT,
  ADD COLUMN "gstNumber" TEXT,
  ADD COLUMN "paymentDetails" TEXT;
