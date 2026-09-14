-- CreateEnum
CREATE TYPE "StatusScope" AS ENUM ('LEAD', 'BOOKING');

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "serviceStatusId" TEXT;

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "serviceStatusId" TEXT;

-- CreateTable
CREATE TABLE "ServiceStatus" (
    "id" TEXT NOT NULL,
    "serviceType" "ServiceType" NOT NULL,
    "scope" "StatusScope" NOT NULL,
    "name" TEXT NOT NULL,
    "group" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isTerminal" BOOLEAN NOT NULL DEFAULT false,
    "blocksRefund" BOOLEAN NOT NULL DEFAULT false,
    "customerLabel" TEXT,
    "mapsToLeadStatus" "LeadStatus",
    "mapsToBookingStatus" "BookingStatus",
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceStatusTransition" (
    "id" TEXT NOT NULL,
    "fromStatusId" TEXT NOT NULL,
    "toStatusId" TEXT NOT NULL,

    CONSTRAINT "ServiceStatusTransition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServiceStatus_serviceType_scope_idx" ON "ServiceStatus"("serviceType", "scope");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceStatus_serviceType_scope_name_key" ON "ServiceStatus"("serviceType", "scope", "name");

-- CreateIndex
CREATE INDEX "ServiceStatusTransition_fromStatusId_idx" ON "ServiceStatusTransition"("fromStatusId");

-- CreateIndex
CREATE INDEX "ServiceStatusTransition_toStatusId_idx" ON "ServiceStatusTransition"("toStatusId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceStatusTransition_fromStatusId_toStatusId_key" ON "ServiceStatusTransition"("fromStatusId", "toStatusId");

-- CreateIndex
CREATE INDEX "Booking_serviceStatusId_idx" ON "Booking"("serviceStatusId");

-- CreateIndex
CREATE INDEX "Lead_serviceStatusId_idx" ON "Lead"("serviceStatusId");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_serviceStatusId_fkey" FOREIGN KEY ("serviceStatusId") REFERENCES "ServiceStatus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_serviceStatusId_fkey" FOREIGN KEY ("serviceStatusId") REFERENCES "ServiceStatus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceStatusTransition" ADD CONSTRAINT "ServiceStatusTransition_fromStatusId_fkey" FOREIGN KEY ("fromStatusId") REFERENCES "ServiceStatus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceStatusTransition" ADD CONSTRAINT "ServiceStatusTransition_toStatusId_fkey" FOREIGN KEY ("toStatusId") REFERENCES "ServiceStatus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
