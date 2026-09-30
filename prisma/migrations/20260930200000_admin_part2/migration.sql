-- AlterTable
ALTER TABLE "Coupon" ADD COLUMN     "leadId" TEXT,
ADD COLUMN     "maxDiscount" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "CouponConfig" ADD COLUMN     "abandonedAfterHours" INTEGER,
ADD COLUMN     "abandonedCouponEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "abandonedCouponMaxDiscount" DECIMAL(10,2),
ADD COLUMN     "abandonedCouponType" "CouponType",
ADD COLUMN     "abandonedCouponValidDays" INTEGER,
ADD COLUMN     "abandonedCouponValue" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "SystemConfig" ADD COLUMN     "defaultPaymentLinkHours" INTEGER;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "countriesHandled" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "AssignmentRule" (
    "id" TEXT NOT NULL,
    "serviceType" "ServiceType" NOT NULL,
    "subServiceId" TEXT,
    "roleId" TEXT,
    "maxOpenLeads" INTEGER,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssignmentRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EscalationRule" (
    "id" TEXT NOT NULL,
    "serviceType" "ServiceType",
    "serviceStatusId" TEXT,
    "hoursInStatus" INTEGER NOT NULL,
    "escalateTo" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EscalationRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssignmentRule_serviceType_active_idx" ON "AssignmentRule"("serviceType", "active");

-- CreateIndex
CREATE INDEX "EscalationRule_active_idx" ON "EscalationRule"("active");

