-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "appliedToEmbassyAt" TIMESTAMP(3),
ADD COLUMN     "visaRejectionReason" TEXT;

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "requestReason" TEXT;


-- P11: tag the New Visa embassy statuses with the staff actions that land on
-- them (only an empty systemEvent is filled; never an Admin choice).
UPDATE "ServiceStatus" SET "systemEvent" = v.event
FROM (VALUES
  ('Submitted to Embassy', 'EMBASSY_APPLIED'),
  ('Additional Document Requested', 'EMBASSY_ADDITIONAL_DOCS'),
  ('Re-submitted', 'EMBASSY_RESUBMITTED'),
  ('Approved', 'EMBASSY_APPROVED'),
  ('Rejected', 'EMBASSY_REJECTED')
) AS v(name, event)
WHERE "ServiceStatus"."serviceType" = 'NEW_VISA' AND "ServiceStatus"."scope" = 'BOOKING'
  AND "ServiceStatus"."name" = v.name AND "ServiceStatus"."systemEvent" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "ServiceStatus" other
    WHERE other."serviceType" = 'NEW_VISA' AND other."scope" = 'BOOKING' AND other."systemEvent" = v.event
  );

-- P11: transitions for those actions (added only; nothing removed).
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id"
FROM (VALUES
  ('Submitted to Embassy', 'Additional Document Requested'),
  ('Submitted to Embassy', 'Approved'),
  ('Submitted to Embassy', 'Rejected'),
  ('Embassy Reviewing', 'Approved'),
  ('Additional Document Requested', 'Re-submitted'),
  ('Customer Upload Pending', 'Re-submitted'),
  ('Approved', 'Visa PDF Delivered')
) AS v(from_name, to_name)
JOIN "ServiceStatus" f ON f."serviceType" = 'NEW_VISA' AND f."scope" = 'BOOKING' AND f."name" = v.from_name
JOIN "ServiceStatus" t ON t."serviceType" = 'NEW_VISA' AND t."scope" = 'BOOKING' AND t."name" = v.to_name
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
