-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "linkedBookingId" TEXT;

-- AlterTable
ALTER TABLE "ReturnTicketDestination" ADD COLUMN     "cancellationFee" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "ServiceTimelineConfig" ADD COLUMN     "autoCompleteAfterDays" INTEGER;

-- CreateIndex
CREATE INDEX "Booking_linkedBookingId_idx" ON "Booking"("linkedBookingId");

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_linkedBookingId_fkey" FOREIGN KEY ("linkedBookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- P17: Return Ticket "Ticket Issued" is reached by staff issuing the
-- reservation (not by a TICKET_PDF delivery, which this service never
-- sends — its output is RESERVATION_PDF -> "Delivered"). Only the seeded
-- default tag is replaced; an Admin-chosen tag is left alone.
UPDATE "ServiceStatus" SET "systemEvent" = 'RT_RESERVATION_ISSUED'
WHERE "serviceType" = 'RETURN_TICKET' AND "scope" = 'BOOKING' AND "name" = 'Ticket Issued'
  AND "systemEvent" = 'DELIVERED_TICKET_PDF'
  AND NOT EXISTS (
    SELECT 1 FROM "ServiceStatus" other
    WHERE other."serviceType" = 'RETURN_TICKET' AND other."scope" = 'BOOKING' AND other."systemEvent" = 'RT_RESERVATION_ISSUED'
  );

-- P17: the auto-complete job lands delivered bookings on "Completed".
UPDATE "ServiceStatus" SET "systemEvent" = 'RT_AUTO_COMPLETED'
WHERE "serviceType" = 'RETURN_TICKET' AND "scope" = 'BOOKING' AND "name" = 'Completed'
  AND "systemEvent" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "ServiceStatus" other
    WHERE other."serviceType" = 'RETURN_TICKET' AND other."scope" = 'BOOKING' AND other."systemEvent" = 'RT_AUTO_COMPLETED'
  );
