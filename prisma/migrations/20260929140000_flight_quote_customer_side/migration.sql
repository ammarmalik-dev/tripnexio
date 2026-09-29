-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "crossSellOptOut" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Quotation" ADD COLUMN     "bookingDeadline" TIMESTAMP(3),
ADD COLUMN     "cancellationAllowed" BOOLEAN,
ADD COLUMN     "cancellationCharge" DECIMAL(10,2),
ADD COLUMN     "chargeBasis" TEXT,
ADD COLUMN     "customerCancellationPolicy" TEXT,
ADD COLUMN     "estimatedRefund" DECIMAL(10,2),
ADD COLUMN     "fareRules" TEXT,
ADD COLUMN     "noShowCharge" DECIMAL(10,2),
ADD COLUMN     "reportingTime" TEXT,
ADD COLUMN     "restrictions" TEXT,
ADD COLUMN     "terminal" TEXT,
ADD COLUMN     "timeCondition" TEXT,
ADD COLUMN     "vendorReference" TEXT;

