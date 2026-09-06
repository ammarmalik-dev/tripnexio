-- CreateEnum
CREATE TYPE "CouponType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT');

-- DropIndex
DROP INDEX "DocumentRequirement_nationality_documentName_key";

-- AlterTable (added nullable first, backfilled, then made NOT NULL — the
-- straight NOT NULL ADD COLUMN Prisma generated fails against the existing
-- sample row with no default)
ALTER TABLE "DocumentRequirement" ADD COLUMN     "serviceType" "ServiceType";
UPDATE "DocumentRequirement" SET "serviceType" = 'NEW_VISA' WHERE "serviceType" IS NULL;
ALTER TABLE "DocumentRequirement" ALTER COLUMN "serviceType" SET NOT NULL;

-- CreateTable
CREATE TABLE "PricingRule" (
    "id" TEXT NOT NULL,
    "serviceType" "ServiceType" NOT NULL,
    "paxType" "PaxType" NOT NULL,
    "nationality" TEXT,
    "basePrice" DECIMAL(10,2) NOT NULL,
    "additionalCharges" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PricingRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Coupon" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "CouponType" NOT NULL,
    "value" DECIMAL(10,2) NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "usageLimit" INTEGER,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PricingRule_serviceType_idx" ON "PricingRule"("serviceType");

-- CreateIndex
CREATE INDEX "PricingRule_active_idx" ON "PricingRule"("active");

-- CreateIndex
CREATE UNIQUE INDEX "Coupon_code_key" ON "Coupon"("code");

-- CreateIndex
CREATE INDEX "Coupon_active_idx" ON "Coupon"("active");

-- CreateIndex
CREATE INDEX "DocumentRequirement_serviceType_idx" ON "DocumentRequirement"("serviceType");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentRequirement_nationality_serviceType_documentName_key" ON "DocumentRequirement"("nationality", "serviceType", "documentName");

