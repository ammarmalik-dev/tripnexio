-- Step 14 (client-locked-spec DEVELOPMENT_ROADMAP.md, audit §3.3/§3.5):
-- CRM.md §12, locked: "Each PAX must be independently visible... Do not
-- force all PAX into one combined status." CRM.md §21, locked: "Refunds
-- require... Passenger selection where partial passenger refund applies."

-- CreateTable
CREATE TABLE "BookingPassenger" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "passengerId" TEXT NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingPassenger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BookingPassenger_bookingId_idx" ON "BookingPassenger"("bookingId");

-- CreateIndex
CREATE INDEX "BookingPassenger_passengerId_idx" ON "BookingPassenger"("passengerId");

-- CreateIndex
CREATE INDEX "BookingPassenger_status_idx" ON "BookingPassenger"("status");

-- CreateIndex
CREATE UNIQUE INDEX "BookingPassenger_bookingId_passengerId_key" ON "BookingPassenger"("bookingId", "passengerId");

-- AddForeignKey
ALTER TABLE "BookingPassenger" ADD CONSTRAINT "BookingPassenger_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingPassenger" ADD CONSTRAINT "BookingPassenger_passengerId_fkey" FOREIGN KEY ("passengerId") REFERENCES "Passenger"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "Refund" ADD COLUMN "passengerIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
