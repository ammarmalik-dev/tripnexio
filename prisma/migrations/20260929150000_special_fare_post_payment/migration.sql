-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "alternativeOffer" JSONB,
ADD COLUMN     "finalConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "pnr" TEXT,
ADD COLUMN     "pnrRecordedAt" TIMESTAMP(3),
ADD COLUMN     "pnrVendorReference" TEXT,
ADD COLUMN     "ticketBaggage" TEXT,
ADD COLUMN     "ticketIssuedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "BookingPassenger" ADD COLUMN     "ticketNumber" TEXT;


-- P16: "PNR Recorded" — PNR and ticket issuance are separate states (Locked
-- v2.0 Q18). Placed just before "Ticket Issued"; added only if missing.
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "customerLabel", "displayOrder", "isTerminal", "blocksRefund", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
SELECT 'ss_fsf_pnr_recorded', 'FLIGHT_SPECIAL_FARE', 'BOOKING', 'PNR Recorded', 'PNR Confirmed', t."displayOrder" - 5, false, false, 'PROCESSING', 'FSF_PNR_RECORDED', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ServiceStatus" t
WHERE t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'BOOKING' AND t."name" = 'Ticket Issued'
  AND NOT EXISTS (SELECT 1 FROM "ServiceStatus" s WHERE s."serviceType" = 'FLIGHT_SPECIAL_FARE' AND s."scope" = 'BOOKING' AND s."name" = 'PNR Recorded');

-- P16: tag the post-payment statuses with the staff/system actions that land
-- on them (only an empty systemEvent is filled; never an Admin choice).
UPDATE "ServiceStatus" SET "systemEvent" = v.event
FROM (VALUES
  ('Final Confirmation', 'FSF_FINAL_CONFIRMATION'),
  ('Sent to Airlines', 'FSF_AVAILABILITY_CONFIRMED'),
  ('Alternative Offered', 'FSF_ALTERNATIVE_OFFERED'),
  ('Additional Payment Pending', 'FSF_ADDITIONAL_PAYMENT_PENDING'),
  ('Refund Pending', 'FSF_REFUND_PENDING')
) AS v(name, event)
WHERE "ServiceStatus"."serviceType" = 'FLIGHT_SPECIAL_FARE' AND "ServiceStatus"."scope" = 'BOOKING'
  AND "ServiceStatus"."name" = v.name AND "ServiceStatus"."systemEvent" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "ServiceStatus" other
    WHERE other."serviceType" = 'FLIGHT_SPECIAL_FARE' AND other."scope" = 'BOOKING' AND other."systemEvent" = v.event
  );

-- P16: transitions for the post-payment flow (added only; nothing removed).
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id"
FROM (VALUES
  ('Final Confirmation', 'Sent to Airlines'),
  ('Final Confirmation', 'Refund Pending'),
  ('Documents Validated', 'Alternative Offered'),
  ('Documents Validated', 'Refund Pending'),
  ('Alternative Offered', 'Additional Payment Pending'),
  ('Alternative Offered', 'Refund Pending'),
  ('Additional Payment Pending', 'Sent to Airlines'),
  ('Sent to Airlines', 'PNR Recorded'),
  ('PNR Recorded', 'Ticket Issued'),
  ('PNR Recorded', 'Cancelled')
) AS v(from_name, to_name)
JOIN "ServiceStatus" f ON f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'BOOKING' AND f."name" = v.from_name
JOIN "ServiceStatus" t ON t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'BOOKING' AND t."name" = v.to_name
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
