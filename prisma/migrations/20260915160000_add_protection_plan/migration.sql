-- CreateEnum
CREATE TYPE "ProtectionPlanStatus" AS ENUM ('NOT_OFFERED', 'OFFERED', 'SELECTED_TERMS_PENDING', 'TERMS_ACCEPTED', 'PURCHASED', 'UNDER_ELIGIBILITY_REVIEW', 'ELIGIBLE', 'INELIGIBLE', 'CANCELLED', 'REFUND_UNDER_REVIEW', 'REFUND_APPROVED', 'REFUND_REJECTED', 'REFUND_PROCESSING', 'REFUND_COMPLETED');

-- CreateTable
CREATE TABLE "ProtectionPlanConfig" (
    "id" TEXT NOT NULL,
    "defaultPrice" DECIMAL(10,2) NOT NULL,
    "termsText" TEXT NOT NULL,
    "eligibilityConditions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProtectionPlanConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProtectionPlan" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "passengerId" TEXT NOT NULL,
    "status" "ProtectionPlanStatus" NOT NULL DEFAULT 'NOT_OFFERED',
    "price" DECIMAL(10,2) NOT NULL,
    "termsAcceptedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "refundAmount" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProtectionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProtectionPlan_bookingId_idx" ON "ProtectionPlan"("bookingId");

-- CreateIndex
CREATE INDEX "ProtectionPlan_passengerId_idx" ON "ProtectionPlan"("passengerId");

-- CreateIndex
CREATE INDEX "ProtectionPlan_status_idx" ON "ProtectionPlan"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ProtectionPlan_bookingId_passengerId_key" ON "ProtectionPlan"("bookingId", "passengerId");

-- AddForeignKey
ALTER TABLE "ProtectionPlan" ADD CONSTRAINT "ProtectionPlan_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtectionPlan" ADD CONSTRAINT "ProtectionPlan_passengerId_fkey" FOREIGN KEY ("passengerId") REFERENCES "Passenger"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
