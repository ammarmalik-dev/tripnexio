-- CreateEnum
CREATE TYPE "RefundCutoff" AS ENUM ('NEVER', 'EXTERNAL_SUBMISSION', 'PACKAGE_GENERATED');

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "followUpOptOut" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "rejectionReason" TEXT;

-- AlterTable
ALTER TABLE "ServiceTimelineConfig" ADD COLUMN     "followUpIntervalDays" INTEGER;

-- CreateTable
CREATE TABLE "RefundConfig" (
    "serviceType" "ServiceType" NOT NULL,
    "fullRefundWindowHours" INTEGER,
    "preValidationDeduction" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "postValidationDeduction" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "noRefundAfter" "RefundCutoff" NOT NULL DEFAULT 'NEVER',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefundConfig_pkey" PRIMARY KEY ("serviceType")
);

-- Default refund rules (locked client refund policy). New rows only; never overwrites.
INSERT INTO "RefundConfig" ("serviceType", "fullRefundWindowHours", "preValidationDeduction", "postValidationDeduction", "noRefundAfter", "updatedAt") VALUES
  ('NEW_VISA', 4, 250, 250, 'EXTERNAL_SUBMISSION', CURRENT_TIMESTAMP),
  ('OTB', NULL, 0, 250, 'EXTERNAL_SUBMISSION', CURRENT_TIMESTAMP),
  ('VISA_CHANGE', NULL, 250, 250, 'PACKAGE_GENERATED', CURRENT_TIMESTAMP),
  ('RETURN_TICKET', NULL, 0, 0, 'EXTERNAL_SUBMISSION', CURRENT_TIMESTAMP),
  ('VISA_EXTENSION', NULL, 0, 0, 'NEVER', CURRENT_TIMESTAMP),
  ('FLIGHT_SPECIAL_FARE', NULL, 0, 0, 'NEVER', CURRENT_TIMESTAMP),
  ('OTHER', NULL, 0, 0, 'NEVER', CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType") DO NOTHING;
