-- AlterTable
ALTER TABLE "Quotation" ADD COLUMN     "operationalBlock" JSONB;

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "exitCompletedAt" TIMESTAMP(3),
ADD COLUMN     "exitDetails" JSONB;


-- P14: tag the Visa Change post-package statuses with the staff actions that
-- land on them (only an empty systemEvent is filled; never an Admin choice).
-- New Visa Processing / Additional Documents Required / Visa Approved / Visa
-- Rejected reuse the embassy events already used by New Visa (P11).
UPDATE "ServiceStatus" SET "systemEvent" = v.event
FROM (VALUES
  ('Exit Completed', 'VC_EXIT_COMPLETED'),
  ('New Visa Processing', 'EMBASSY_APPLIED'),
  ('Additional Documents Required', 'EMBASSY_ADDITIONAL_DOCS'),
  ('Visa Approved', 'EMBASSY_APPROVED'),
  ('Visa Rejected', 'EMBASSY_REJECTED')
) AS v(name, event)
WHERE "ServiceStatus"."serviceType" = 'VISA_CHANGE' AND "ServiceStatus"."scope" = 'BOOKING'
  AND "ServiceStatus"."name" = v.name AND "ServiceStatus"."systemEvent" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "ServiceStatus" other
    WHERE other."serviceType" = 'VISA_CHANGE' AND other."scope" = 'BOOKING' AND other."systemEvent" = v.event
  );

-- P14: "Border Exited" was wrong for Airport-to-Airport exits. Only replaced
-- when still the original seeded wording (never an Admin edit).
UPDATE "ServiceStatus" SET "customerLabel" = 'Exit Completed'
WHERE "serviceType" = 'VISA_CHANGE' AND "scope" = 'BOOKING' AND "name" = 'Exit Completed' AND "customerLabel" = 'Border Exited';

-- P14: transitions for the staff actions (added only; nothing removed).
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id"
FROM (VALUES
  ('Package Generated', 'Exit Completed'),
  ('New Visa Processing', 'Visa Approved'),
  ('Additional Documents Required', 'Visa Approved'),
  ('Additional Documents Required', 'Visa Rejected'),
  ('Additional Documents Submitted', 'Visa Approved'),
  ('Additional Documents Submitted', 'Visa Rejected'),
  ('Visa Approved', 'Visa Delivered')
) AS v(from_name, to_name)
JOIN "ServiceStatus" f ON f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'BOOKING' AND f."name" = v.from_name
JOIN "ServiceStatus" t ON t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'BOOKING' AND t."name" = v.to_name
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
