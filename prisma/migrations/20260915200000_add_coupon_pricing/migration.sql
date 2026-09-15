-- CreateEnum
CREATE TYPE "CouponCategory" AS ENUM ('EMPLOYEE', 'EXTERNAL', 'ABANDONED_QUOTATION');

-- AlterTable
ALTER TABLE "Coupon" ADD COLUMN     "category" "CouponCategory" NOT NULL DEFAULT 'EXTERNAL';

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "couponCode" TEXT,
ADD COLUMN     "couponDiscount" DECIMAL(10,2),
ADD COLUMN     "couponId" TEXT;

-- AlterTable
ALTER TABLE "Quotation" ADD COLUMN     "couponCode" TEXT,
ADD COLUMN     "couponDiscount" DECIMAL(10,2),
ADD COLUMN     "couponId" TEXT;

-- CreateTable
CREATE TABLE "CouponConfig" (
    "id" TEXT NOT NULL,
    "employeeCouponCap" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CouponConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Coupon_category_idx" ON "Coupon"("category");

-- CreateIndex
CREATE INDEX "Payment_couponId_idx" ON "Payment"("couponId");

-- CreateIndex
CREATE INDEX "Quotation_couponId_idx" ON "Quotation"("couponId");

-- AddForeignKey
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;
