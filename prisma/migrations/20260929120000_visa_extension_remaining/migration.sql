-- AlterEnum
ALTER TYPE "ExtensionOutcome" ADD VALUE 'EXTENDED';

-- AlterTable
ALTER TABLE "Quotation" ADD COLUMN     "otherCharges" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "originalBookingId" TEXT;

-- CreateIndex
CREATE INDEX "Booking_originalBookingId_idx" ON "Booking"("originalBookingId");

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_originalBookingId_fkey" FOREIGN KEY ("originalBookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- P13: tag the Visa Extension outcome statuses with the staff outcome actions
-- that land on them (only an empty systemEvent is filled; never an Admin choice).
UPDATE "ServiceStatus" SET "systemEvent" = v.event
FROM (VALUES
  ('Extended', 'EXTENSION_EXTENDED'),
  ('Not Accepted', 'EXTENSION_NOT_ACCEPTED'),
  ('Rejected', 'EXTENSION_REJECTED')
) AS v(name, event)
WHERE "ServiceStatus"."serviceType" = 'VISA_EXTENSION' AND "ServiceStatus"."scope" = 'BOOKING'
  AND "ServiceStatus"."name" = v.name AND "ServiceStatus"."systemEvent" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "ServiceStatus" other
    WHERE other."serviceType" = 'VISA_EXTENSION' AND other."scope" = 'BOOKING' AND other."systemEvent" = v.event
  );

-- P13: outcomes can be recorded from any in-process step (added only; nothing removed).
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id"
FROM (VALUES
  ('Processing', 'Extended'),
  ('Additional Information Required', 'Not Accepted'),
  ('Additional Information Required', 'Rejected'),
  ('Re-processing', 'Not Accepted'),
  ('Re-processing', 'Rejected')
) AS v(from_name, to_name)
JOIN "ServiceStatus" f ON f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'BOOKING' AND f."name" = v.from_name
JOIN "ServiceStatus" t ON t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'BOOKING' AND t."name" = v.to_name
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
