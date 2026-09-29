-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "otbDecidedAt" TIMESTAMP(3),
ADD COLUMN     "otbOutcomeNote" TEXT,
ADD COLUMN     "otbSubmittedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "OtbPrice" (
    "id" TEXT NOT NULL,
    "airlineId" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "paxType" "PaxType" NOT NULL,
    "normalPrice" DECIMAL(10,2) NOT NULL,
    "urgentPrice" DECIMAL(10,2),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OtbPrice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OtbPrice_active_idx" ON "OtbPrice"("active");

-- CreateIndex
CREATE INDEX "OtbPrice_countryId_idx" ON "OtbPrice"("countryId");

-- CreateIndex
CREATE UNIQUE INDEX "OtbPrice_airlineId_countryId_paxType_key" ON "OtbPrice"("airlineId", "countryId", "paxType");

-- AddForeignKey
ALTER TABLE "OtbPrice" ADD CONSTRAINT "OtbPrice_airlineId_fkey" FOREIGN KEY ("airlineId") REFERENCES "Airline"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtbPrice" ADD CONSTRAINT "OtbPrice_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- P18: OTB staff actions land on these statuses (only an empty systemEvent
-- is filled; never an Admin choice). "OTB Approved" moves from the
-- confirmation-delivery event to its own approval action, which now
-- requires the airline's OTB PNR/reference.
UPDATE "ServiceStatus" SET "systemEvent" = 'OTB_APPROVED'
WHERE "serviceType" = 'OTB' AND "scope" = 'BOOKING' AND "name" = 'OTB Approved'
  AND "systemEvent" = 'DELIVERED_OTB_CONFIRMATION'
  AND NOT EXISTS (SELECT 1 FROM "ServiceStatus" o WHERE o."serviceType" = 'OTB' AND o."scope" = 'BOOKING' AND o."systemEvent" = 'OTB_APPROVED');

UPDATE "ServiceStatus" SET "systemEvent" = v.event
FROM (VALUES
  ('Staff Verification Pending', 'OTB_STAFF_VERIFICATION'),
  ('Submitted to Airline', 'OTB_SUBMITTED'),
  ('Airline Processing', 'OTB_AIRLINE_PROCESSING'),
  ('Additional Documents Required', 'OTB_ADDITIONAL_DOCUMENTS'),
  ('OTB Rejected', 'OTB_REJECTED'),
  ('Unable to Process', 'OTB_UNABLE_TO_PROCESS')
) AS v(name, event)
WHERE "ServiceStatus"."serviceType" = 'OTB' AND "ServiceStatus"."scope" = 'BOOKING'
  AND "ServiceStatus"."name" = v.name AND "ServiceStatus"."systemEvent" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "ServiceStatus" other
    WHERE other."serviceType" = 'OTB' AND other."scope" = 'BOOKING' AND other."systemEvent" = v.event
  );

-- P18: OTB.md §21 — customers hear about these by WhatsApp + email (generic
-- status-update template; OTB Approved sends its own OTB_APPROVED message).
UPDATE "ServiceStatus" SET "notificationEvent" = 'SERVICE_STATUS_UPDATE'
WHERE "serviceType" = 'OTB' AND "scope" = 'BOOKING' AND "notificationEvent" IS NULL
  AND "name" IN ('Submitted to Airline', 'Additional Documents Required', 'OTB Rejected', 'Unable to Process');

-- P18: OTB.md §17 — the customer portal shows "OTB Approved" (only the seeded label is replaced).
UPDATE "ServiceStatus" SET "customerLabel" = 'OTB Approved'
WHERE "serviceType" = 'OTB' AND "scope" = 'BOOKING' AND "name" = 'OTB Approved' AND "customerLabel" = 'OTB Updated';

-- P18: transitions for the OTB staff actions (added only; nothing removed).
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id"
FROM (VALUES
  ('Payment Successful', 'Staff Verification Pending'),
  ('Staff Verification Pending', 'Ready for Submission'),
  ('Staff Verification Pending', 'Submitted to Airline'),
  ('Documents Validated', 'Submitted to Airline'),
  ('Submitted to Airline', 'Additional Documents Required'),
  ('Submitted to Airline', 'OTB Approved'),
  ('Submitted to Airline', 'OTB Rejected'),
  ('Airline Processing', 'OTB Approved'),
  ('Airline Processing', 'OTB Rejected'),
  ('Additional Documents Required', 'OTB Rejected'),
  ('Additional Documents Submitted', 'Airline Processing'),
  ('Additional Documents Submitted', 'OTB Rejected'),
  ('Payment Successful', 'Unable to Process'),
  ('OTB Booking Generated', 'Unable to Process'),
  ('Staff Verification Pending', 'Unable to Process'),
  ('Documents Required', 'Unable to Process'),
  ('Document Validation Pending', 'Unable to Process'),
  ('Documents Validated', 'Unable to Process'),
  ('Ready for Submission', 'Unable to Process'),
  ('Unable to Process', 'Refund Processing')
) AS v(from_name, to_name)
JOIN "ServiceStatus" f ON f."serviceType" = 'OTB' AND f."scope" = 'BOOKING' AND f."name" = v.from_name
JOIN "ServiceStatus" t ON t."serviceType" = 'OTB' AND t."scope" = 'BOOKING' AND t."name" = v.to_name
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;

-- P18: OTB.md §13 approval message (client-locked wording), email + WhatsApp.
-- Admin-editable afterwards; never overwrites an existing template.
INSERT INTO "NotificationTemplate" ("id", "event", "channel", "subject", "body", "active", "updatedAt")
VALUES
  ('notification-template-otb-approved', 'OTB_APPROVED', 'EMAIL',
   'Your OTB PNR has been approved by the airline — {{leadReference}}',
   E'Hi {{customerName}},\n\nYour OTB PNR has been approved by the airline.\n\nOTB PNR / reference: {{otbReference}}\nBooking: {{leadReference}}\n\nYou can see this in your TripNexio account and on Track Status.\n{{returnTicketOffer}}\n\n— TripNexio',
   true, CURRENT_TIMESTAMP),
  ('notification-template-otb-approved-wa', 'OTB_APPROVED', 'WHATSAPP', NULL,
   'Hi {{customerName}}, your OTB PNR has been approved by the airline. OTB PNR / reference: {{otbReference}} (booking {{leadReference}}). {{returnTicketOffer}}',
   true, CURRENT_TIMESTAMP)
ON CONFLICT ("event", "channel") DO NOTHING;
