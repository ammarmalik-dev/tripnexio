-- P08: per-service status engine (CRM.md §14, ADMIN.md §16-17, Locked v2.0 §13).
-- Generated from prisma/seed-service-statuses.ts (ALL_STATUS_SEED / transitionsFor),
-- so production gets the same catalog the dev seed creates. Idempotent and
-- non-destructive: existing statuses are never renamed, relabelled or
-- deleted — only an empty customerLabel/systemEvent is filled in.

ALTER TABLE "ServiceStatus" ADD COLUMN "notificationEvent" TEXT;
ALTER TABLE "ServiceStatus" ADD COLUMN "systemEvent" TEXT;

-- Space existing display orders by 10 (relative order, including any Admin
-- reordering, is preserved) so new statuses slot in between.
UPDATE "ServiceStatus" SET "displayOrder" = "displayOrder" * 10;


-- NEW_VISA / BOOKING
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('NEW_VISA|BOOKING|Draft'), 'NEW_VISA', 'BOOKING', 'Draft', NULL, 0, false, false, NULL, NULL, 'PENDING', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('NEW_VISA|BOOKING|Payment Pending'), 'NEW_VISA', 'BOOKING', 'Payment Pending', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'NEW_VISA' AND "scope" = 'BOOKING' AND "name" = 'Draft') + 1, 10), false, false, NULL, NULL, 'PENDING', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('NEW_VISA|BOOKING|Payment Received'), 'NEW_VISA', 'BOOKING', 'Payment Received', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'NEW_VISA' AND "scope" = 'BOOKING' AND "name" = 'Payment Pending') + 1, 20), false, false, 'Application Received', NULL, 'CONFIRMED', 'PAYMENT_SUCCESS', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('NEW_VISA|BOOKING|Documents Pending'), 'NEW_VISA', 'BOOKING', 'Documents Pending', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'NEW_VISA' AND "scope" = 'BOOKING' AND "name" = 'Payment Received') + 1, 30), false, false, 'Documents Upload Pending', NULL, 'CONFIRMED', 'DOCUMENTS_REQUESTED', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('NEW_VISA|BOOKING|Documents Received'), 'NEW_VISA', 'BOOKING', 'Documents Received', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'NEW_VISA' AND "scope" = 'BOOKING' AND "name" = 'Documents Pending') + 1, 40), false, false, 'Documents Uploaded', NULL, 'CONFIRMED', 'DOCUMENTS_RECEIVED', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('NEW_VISA|BOOKING|OCR / Validation'), 'NEW_VISA', 'BOOKING', 'OCR / Validation', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'NEW_VISA' AND "scope" = 'BOOKING' AND "name" = 'Documents Received') + 1, 50), false, false, NULL, NULL, 'CONFIRMED', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('NEW_VISA|BOOKING|Staff Verification'), 'NEW_VISA', 'BOOKING', 'Staff Verification', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'NEW_VISA' AND "scope" = 'BOOKING' AND "name" = 'OCR / Validation') + 1, 60), false, false, NULL, NULL, 'CONFIRMED', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('NEW_VISA|BOOKING|Ready for Submission'), 'NEW_VISA', 'BOOKING', 'Ready for Submission', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'NEW_VISA' AND "scope" = 'BOOKING' AND "name" = 'Staff Verification') + 1, 70), false, false, 'Documents Validated', NULL, 'CONFIRMED', 'DOCUMENTS_VALIDATED', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('NEW_VISA|BOOKING|Submitted to Embassy'), 'NEW_VISA', 'BOOKING', 'Submitted to Embassy', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'NEW_VISA' AND "scope" = 'BOOKING' AND "name" = 'Ready for Submission') + 1, 80), false, true, 'Applied to Embassy', NULL, 'PROCESSING', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('NEW_VISA|BOOKING|Embassy Reviewing'), 'NEW_VISA', 'BOOKING', 'Embassy Reviewing', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'NEW_VISA' AND "scope" = 'BOOKING' AND "name" = 'Submitted to Embassy') + 1, 90), false, true, NULL, NULL, 'PROCESSING', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('NEW_VISA|BOOKING|Additional Document Requested'), 'NEW_VISA', 'BOOKING', 'Additional Document Requested', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'NEW_VISA' AND "scope" = 'BOOKING' AND "name" = 'Embassy Reviewing') + 1, 100), false, true, 'Additional Documents Required', NULL, 'PROCESSING', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('NEW_VISA|BOOKING|Customer Upload Pending'), 'NEW_VISA', 'BOOKING', 'Customer Upload Pending', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'NEW_VISA' AND "scope" = 'BOOKING' AND "name" = 'Additional Document Requested') + 1, 110), false, true, NULL, NULL, 'PROCESSING', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('NEW_VISA|BOOKING|Re-validation'), 'NEW_VISA', 'BOOKING', 'Re-validation', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'NEW_VISA' AND "scope" = 'BOOKING' AND "name" = 'Customer Upload Pending') + 1, 120), false, true, 'Additional Documents Validated', NULL, 'PROCESSING', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('NEW_VISA|BOOKING|Re-submitted'), 'NEW_VISA', 'BOOKING', 'Re-submitted', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'NEW_VISA' AND "scope" = 'BOOKING' AND "name" = 'Re-validation') + 1, 130), false, true, 'Additional Documents Submitted', NULL, 'PROCESSING', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('NEW_VISA|BOOKING|Approved'), 'NEW_VISA', 'BOOKING', 'Approved', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'NEW_VISA' AND "scope" = 'BOOKING' AND "name" = 'Re-submitted') + 1, 140), false, true, 'Visa Approved', NULL, 'PROCESSING', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('NEW_VISA|BOOKING|Rejected'), 'NEW_VISA', 'BOOKING', 'Rejected', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'NEW_VISA' AND "scope" = 'BOOKING' AND "name" = 'Approved') + 1, 150), true, true, 'Rejected', NULL, 'CANCELLED', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('NEW_VISA|BOOKING|Visa PDF Delivered'), 'NEW_VISA', 'BOOKING', 'Visa PDF Delivered', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'NEW_VISA' AND "scope" = 'BOOKING' AND "name" = 'Rejected') + 1, 160), false, true, NULL, NULL, 'PROCESSING', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('NEW_VISA|BOOKING|Completed'), 'NEW_VISA', 'BOOKING', 'Completed', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'NEW_VISA' AND "scope" = 'BOOKING' AND "name" = 'Visa PDF Delivered') + 1, 170), true, true, NULL, NULL, 'COMPLETED', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('NEW_VISA|BOOKING|On Hold'), 'NEW_VISA', 'BOOKING', 'On Hold', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'NEW_VISA' AND "scope" = 'BOOKING' AND "name" = 'Completed') + 1, 180), false, false, NULL, NULL, NULL, 'ON_HOLD', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'BOOKING' AND f."name" = 'Draft'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'BOOKING' AND t."name" = 'Payment Pending'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'BOOKING' AND f."name" = 'Payment Pending'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'BOOKING' AND t."name" = 'Payment Received'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'BOOKING' AND f."name" = 'Payment Received'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'BOOKING' AND t."name" = 'Documents Pending'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'BOOKING' AND f."name" = 'Documents Pending'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'BOOKING' AND t."name" = 'Documents Received'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'BOOKING' AND f."name" = 'Documents Received'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'BOOKING' AND t."name" = 'OCR / Validation'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'BOOKING' AND f."name" = 'OCR / Validation'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'BOOKING' AND t."name" = 'Staff Verification'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'BOOKING' AND f."name" = 'Staff Verification'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'BOOKING' AND t."name" = 'Ready for Submission'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'BOOKING' AND f."name" = 'Ready for Submission'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'BOOKING' AND t."name" = 'Submitted to Embassy'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'BOOKING' AND f."name" = 'Submitted to Embassy'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'BOOKING' AND t."name" = 'Embassy Reviewing'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'BOOKING' AND f."name" = 'Embassy Reviewing'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'BOOKING' AND t."name" = 'Additional Document Requested'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'BOOKING' AND f."name" = 'Additional Document Requested'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'BOOKING' AND t."name" = 'Customer Upload Pending'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'BOOKING' AND f."name" = 'Customer Upload Pending'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'BOOKING' AND t."name" = 'Re-validation'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'BOOKING' AND f."name" = 'Re-validation'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'BOOKING' AND t."name" = 'Re-submitted'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'BOOKING' AND f."name" = 'Re-submitted'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'BOOKING' AND t."name" = 'Approved'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'BOOKING' AND f."name" = 'Approved'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'BOOKING' AND t."name" = 'Rejected'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'BOOKING' AND f."name" = 'Rejected'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'BOOKING' AND t."name" = 'Visa PDF Delivered'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'BOOKING' AND f."name" = 'Visa PDF Delivered'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'BOOKING' AND t."name" = 'Completed'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'BOOKING' AND f."name" = 'Embassy Reviewing'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'BOOKING' AND t."name" = 'Rejected'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'BOOKING' AND f."name" = 'Re-submitted'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'BOOKING' AND t."name" = 'Embassy Reviewing'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'BOOKING' AND f."name" = 'Re-submitted'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'BOOKING' AND t."name" = 'Approved'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'BOOKING' AND f."name" = 'Re-submitted'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'BOOKING' AND t."name" = 'Rejected'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'BOOKING' AND f."name" = 'Draft'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'BOOKING' AND t."name" = 'Draft'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'BOOKING' AND f."name" = 'Payment Pending'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'BOOKING' AND t."name" = 'Payment Pending'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'BOOKING' AND f."name" = 'Payment Received'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'BOOKING' AND t."name" = 'Payment Received'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'BOOKING' AND f."name" = 'Documents Pending'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'BOOKING' AND t."name" = 'Documents Pending'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'BOOKING' AND f."name" = 'Documents Received'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'BOOKING' AND t."name" = 'Documents Received'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'BOOKING' AND f."name" = 'OCR / Validation'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'BOOKING' AND t."name" = 'OCR / Validation'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'BOOKING' AND f."name" = 'Staff Verification'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'BOOKING' AND t."name" = 'Staff Verification'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'BOOKING' AND f."name" = 'Ready for Submission'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'BOOKING' AND t."name" = 'Ready for Submission'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'BOOKING' AND f."name" = 'Submitted to Embassy'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'BOOKING' AND t."name" = 'Submitted to Embassy'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'BOOKING' AND f."name" = 'Embassy Reviewing'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'BOOKING' AND t."name" = 'Embassy Reviewing'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'BOOKING' AND f."name" = 'Additional Document Requested'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'BOOKING' AND t."name" = 'Additional Document Requested'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'BOOKING' AND f."name" = 'Customer Upload Pending'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'BOOKING' AND t."name" = 'Customer Upload Pending'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'BOOKING' AND f."name" = 'Re-validation'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'BOOKING' AND t."name" = 'Re-validation'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'BOOKING' AND f."name" = 'Re-submitted'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'BOOKING' AND t."name" = 'Re-submitted'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'BOOKING' AND f."name" = 'Approved'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'BOOKING' AND t."name" = 'Approved'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'BOOKING' AND f."name" = 'Visa PDF Delivered'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'BOOKING' AND t."name" = 'Visa PDF Delivered'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;

-- VISA_EXTENSION / BOOKING
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('VISA_EXTENSION|BOOKING|Extension Lead Created'), 'VISA_EXTENSION', 'BOOKING', 'Extension Lead Created', NULL, 0, false, false, 'Extension Request Received', NULL, 'PENDING', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('VISA_EXTENSION|BOOKING|Under Staff Review'), 'VISA_EXTENSION', 'BOOKING', 'Under Staff Review', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'VISA_EXTENSION' AND "scope" = 'BOOKING' AND "name" = 'Extension Lead Created') + 1, 10), false, false, NULL, NULL, 'PENDING', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('VISA_EXTENSION|BOOKING|Visa Verification Required'), 'VISA_EXTENSION', 'BOOKING', 'Visa Verification Required', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'VISA_EXTENSION' AND "scope" = 'BOOKING' AND "name" = 'Under Staff Review') + 1, 20), false, false, NULL, NULL, 'PENDING', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('VISA_EXTENSION|BOOKING|Eligibility Review'), 'VISA_EXTENSION', 'BOOKING', 'Eligibility Review', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'VISA_EXTENSION' AND "scope" = 'BOOKING' AND "name" = 'Visa Verification Required') + 1, 30), false, false, NULL, NULL, 'PENDING', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('VISA_EXTENSION|BOOKING|Vendor/Sponsor Selected'), 'VISA_EXTENSION', 'BOOKING', 'Vendor/Sponsor Selected', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'VISA_EXTENSION' AND "scope" = 'BOOKING' AND "name" = 'Eligibility Review') + 1, 40), false, false, NULL, NULL, 'CONFIRMED', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('VISA_EXTENSION|BOOKING|Quotation Ready'), 'VISA_EXTENSION', 'BOOKING', 'Quotation Ready', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'VISA_EXTENSION' AND "scope" = 'BOOKING' AND "name" = 'Vendor/Sponsor Selected') + 1, 50), false, false, NULL, NULL, 'CONFIRMED', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('VISA_EXTENSION|BOOKING|Payment Pending'), 'VISA_EXTENSION', 'BOOKING', 'Payment Pending', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'VISA_EXTENSION' AND "scope" = 'BOOKING' AND "name" = 'Quotation Ready') + 1, 60), false, false, NULL, NULL, 'CONFIRMED', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('VISA_EXTENSION|BOOKING|Payment Received'), 'VISA_EXTENSION', 'BOOKING', 'Payment Received', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'VISA_EXTENSION' AND "scope" = 'BOOKING' AND "name" = 'Payment Pending') + 1, 70), false, false, NULL, NULL, 'CONFIRMED', 'PAYMENT_SUCCESS', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('VISA_EXTENSION|BOOKING|Documents Validated'), 'VISA_EXTENSION', 'BOOKING', 'Documents Validated', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'VISA_EXTENSION' AND "scope" = 'BOOKING' AND "name" = 'Payment Received') + 1, 80), false, false, 'Document Validated', NULL, 'CONFIRMED', 'DOCUMENTS_VALIDATED', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('VISA_EXTENSION|BOOKING|Processing'), 'VISA_EXTENSION', 'BOOKING', 'Processing', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'VISA_EXTENSION' AND "scope" = 'BOOKING' AND "name" = 'Documents Validated') + 1, 90), false, true, 'Applied to Embassy', NULL, 'PROCESSING', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('VISA_EXTENSION|BOOKING|Additional Information Required'), 'VISA_EXTENSION', 'BOOKING', 'Additional Information Required', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'VISA_EXTENSION' AND "scope" = 'BOOKING' AND "name" = 'Processing') + 1, 100), false, true, NULL, NULL, 'PROCESSING', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('VISA_EXTENSION|BOOKING|Re-processing'), 'VISA_EXTENSION', 'BOOKING', 'Re-processing', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'VISA_EXTENSION' AND "scope" = 'BOOKING' AND "name" = 'Additional Information Required') + 1, 110), false, true, NULL, NULL, 'PROCESSING', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('VISA_EXTENSION|BOOKING|Extended'), 'VISA_EXTENSION', 'BOOKING', 'Extended', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'VISA_EXTENSION' AND "scope" = 'BOOKING' AND "name" = 'Re-processing') + 1, 120), false, true, 'Approved', NULL, 'PROCESSING', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('VISA_EXTENSION|BOOKING|Visa Delivered'), 'VISA_EXTENSION', 'BOOKING', 'Visa Delivered', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'VISA_EXTENSION' AND "scope" = 'BOOKING' AND "name" = 'Extended') + 1, 130), false, true, NULL, NULL, 'PROCESSING', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('VISA_EXTENSION|BOOKING|Completed'), 'VISA_EXTENSION', 'BOOKING', 'Completed', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'VISA_EXTENSION' AND "scope" = 'BOOKING' AND "name" = 'Visa Delivered') + 1, 140), true, true, NULL, NULL, 'COMPLETED', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('VISA_EXTENSION|BOOKING|Not Eligible'), 'VISA_EXTENSION', 'BOOKING', 'Not Eligible', 'Alternative Outcomes', COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'VISA_EXTENSION' AND "scope" = 'BOOKING' AND "name" = 'Completed') + 1, 150), true, false, NULL, NULL, 'CANCELLED', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('VISA_EXTENSION|BOOKING|Not Accepted'), 'VISA_EXTENSION', 'BOOKING', 'Not Accepted', 'Alternative Outcomes', COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'VISA_EXTENSION' AND "scope" = 'BOOKING' AND "name" = 'Not Eligible') + 1, 160), true, false, NULL, NULL, 'CANCELLED', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('VISA_EXTENSION|BOOKING|Rejected'), 'VISA_EXTENSION', 'BOOKING', 'Rejected', 'Alternative Outcomes', COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'VISA_EXTENSION' AND "scope" = 'BOOKING' AND "name" = 'Not Accepted') + 1, 170), true, true, 'Rejected', NULL, 'CANCELLED', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('VISA_EXTENSION|BOOKING|Cancelled'), 'VISA_EXTENSION', 'BOOKING', 'Cancelled', 'Alternative Outcomes', COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'VISA_EXTENSION' AND "scope" = 'BOOKING' AND "name" = 'Rejected') + 1, 180), true, false, NULL, NULL, 'CANCELLED', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('VISA_EXTENSION|BOOKING|Refund Processing'), 'VISA_EXTENSION', 'BOOKING', 'Refund Processing', 'Alternative Outcomes', COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'VISA_EXTENSION' AND "scope" = 'BOOKING' AND "name" = 'Cancelled') + 1, 190), false, false, NULL, NULL, 'REFUNDED', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('VISA_EXTENSION|BOOKING|Refund Completed'), 'VISA_EXTENSION', 'BOOKING', 'Refund Completed', 'Alternative Outcomes', COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'VISA_EXTENSION' AND "scope" = 'BOOKING' AND "name" = 'Refund Processing') + 1, 200), true, false, NULL, NULL, 'REFUNDED', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('VISA_EXTENSION|BOOKING|On Hold'), 'VISA_EXTENSION', 'BOOKING', 'On Hold', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'VISA_EXTENSION' AND "scope" = 'BOOKING' AND "name" = 'Refund Completed') + 1, 210), false, false, NULL, NULL, NULL, 'ON_HOLD', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'BOOKING' AND f."name" = 'Extension Lead Created'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'BOOKING' AND t."name" = 'Under Staff Review'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'BOOKING' AND f."name" = 'Under Staff Review'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'BOOKING' AND t."name" = 'Visa Verification Required'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'BOOKING' AND f."name" = 'Visa Verification Required'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'BOOKING' AND t."name" = 'Eligibility Review'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'BOOKING' AND f."name" = 'Eligibility Review'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'BOOKING' AND t."name" = 'Vendor/Sponsor Selected'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'BOOKING' AND f."name" = 'Vendor/Sponsor Selected'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'BOOKING' AND t."name" = 'Quotation Ready'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'BOOKING' AND f."name" = 'Quotation Ready'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'BOOKING' AND t."name" = 'Payment Pending'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'BOOKING' AND f."name" = 'Payment Pending'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'BOOKING' AND t."name" = 'Payment Received'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'BOOKING' AND f."name" = 'Payment Received'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'BOOKING' AND t."name" = 'Documents Validated'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'BOOKING' AND f."name" = 'Documents Validated'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'BOOKING' AND t."name" = 'Processing'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'BOOKING' AND f."name" = 'Processing'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'BOOKING' AND t."name" = 'Additional Information Required'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'BOOKING' AND f."name" = 'Additional Information Required'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'BOOKING' AND t."name" = 'Re-processing'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'BOOKING' AND f."name" = 'Re-processing'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'BOOKING' AND t."name" = 'Extended'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'BOOKING' AND f."name" = 'Extended'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'BOOKING' AND t."name" = 'Visa Delivered'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'BOOKING' AND f."name" = 'Visa Delivered'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'BOOKING' AND t."name" = 'Completed'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'BOOKING' AND f."name" = 'Not Eligible'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'BOOKING' AND t."name" = 'Not Accepted'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'BOOKING' AND f."name" = 'Not Accepted'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'BOOKING' AND t."name" = 'Rejected'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'BOOKING' AND f."name" = 'Rejected'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'BOOKING' AND t."name" = 'Cancelled'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'BOOKING' AND f."name" = 'Cancelled'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'BOOKING' AND t."name" = 'Refund Processing'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'BOOKING' AND f."name" = 'Refund Processing'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'BOOKING' AND t."name" = 'Refund Completed'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'BOOKING' AND f."name" = 'Processing'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'BOOKING' AND t."name" = 'Not Eligible'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'BOOKING' AND f."name" = 'Processing'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'BOOKING' AND t."name" = 'Not Accepted'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'BOOKING' AND f."name" = 'Processing'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'BOOKING' AND t."name" = 'Rejected'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'BOOKING' AND f."name" = 'Not Accepted'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'BOOKING' AND t."name" = 'Refund Processing'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'BOOKING' AND f."name" = 'Rejected'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'BOOKING' AND t."name" = 'Refund Processing'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'BOOKING' AND f."name" = 'Cancelled'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'BOOKING' AND t."name" = 'Refund Processing'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'BOOKING' AND f."name" = 'Extension Lead Created'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'BOOKING' AND t."name" = 'Extension Lead Created'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'BOOKING' AND f."name" = 'Under Staff Review'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'BOOKING' AND t."name" = 'Under Staff Review'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'BOOKING' AND f."name" = 'Visa Verification Required'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'BOOKING' AND t."name" = 'Visa Verification Required'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'BOOKING' AND f."name" = 'Eligibility Review'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'BOOKING' AND t."name" = 'Eligibility Review'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'BOOKING' AND f."name" = 'Vendor/Sponsor Selected'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'BOOKING' AND t."name" = 'Vendor/Sponsor Selected'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'BOOKING' AND f."name" = 'Quotation Ready'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'BOOKING' AND t."name" = 'Quotation Ready'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'BOOKING' AND f."name" = 'Payment Pending'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'BOOKING' AND t."name" = 'Payment Pending'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'BOOKING' AND f."name" = 'Payment Received'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'BOOKING' AND t."name" = 'Payment Received'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'BOOKING' AND f."name" = 'Documents Validated'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'BOOKING' AND t."name" = 'Documents Validated'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'BOOKING' AND f."name" = 'Processing'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'BOOKING' AND t."name" = 'Processing'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'BOOKING' AND f."name" = 'Additional Information Required'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'BOOKING' AND t."name" = 'Additional Information Required'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'BOOKING' AND f."name" = 'Re-processing'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'BOOKING' AND t."name" = 'Re-processing'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'BOOKING' AND f."name" = 'Extended'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'BOOKING' AND t."name" = 'Extended'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'BOOKING' AND f."name" = 'Visa Delivered'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'BOOKING' AND t."name" = 'Visa Delivered'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'BOOKING' AND f."name" = 'Refund Processing'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'BOOKING' AND t."name" = 'Refund Processing'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;

-- VISA_CHANGE / BOOKING
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('VISA_CHANGE|BOOKING|Lead Created'), 'VISA_CHANGE', 'BOOKING', 'Lead Created', NULL, 0, false, false, 'Visa Change Request Received', NULL, 'PENDING', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('VISA_CHANGE|BOOKING|Availability Check'), 'VISA_CHANGE', 'BOOKING', 'Availability Check', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'VISA_CHANGE' AND "scope" = 'BOOKING' AND "name" = 'Lead Created') + 1, 10), false, false, NULL, NULL, 'PENDING', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('VISA_CHANGE|BOOKING|Availability Confirmed'), 'VISA_CHANGE', 'BOOKING', 'Availability Confirmed', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'VISA_CHANGE' AND "scope" = 'BOOKING' AND "name" = 'Availability Check') + 1, 20), false, false, NULL, NULL, 'PENDING', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('VISA_CHANGE|BOOKING|Customer Notified'), 'VISA_CHANGE', 'BOOKING', 'Customer Notified', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'VISA_CHANGE' AND "scope" = 'BOOKING' AND "name" = 'Availability Confirmed') + 1, 30), false, false, NULL, NULL, 'PENDING', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('VISA_CHANGE|BOOKING|Date/Time/Package Selected'), 'VISA_CHANGE', 'BOOKING', 'Date/Time/Package Selected', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'VISA_CHANGE' AND "scope" = 'BOOKING' AND "name" = 'Customer Notified') + 1, 40), false, false, NULL, NULL, 'PENDING', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('VISA_CHANGE|BOOKING|Payment Pending'), 'VISA_CHANGE', 'BOOKING', 'Payment Pending', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'VISA_CHANGE' AND "scope" = 'BOOKING' AND "name" = 'Date/Time/Package Selected') + 1, 50), false, false, NULL, NULL, 'PENDING', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('VISA_CHANGE|BOOKING|Payment Received'), 'VISA_CHANGE', 'BOOKING', 'Payment Received', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'VISA_CHANGE' AND "scope" = 'BOOKING' AND "name" = 'Payment Pending') + 1, 60), false, false, NULL, NULL, 'CONFIRMED', 'PAYMENT_SUCCESS', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('VISA_CHANGE|BOOKING|Booking ID Generated'), 'VISA_CHANGE', 'BOOKING', 'Booking ID Generated', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'VISA_CHANGE' AND "scope" = 'BOOKING' AND "name" = 'Payment Received') + 1, 70), false, false, NULL, NULL, 'CONFIRMED', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('VISA_CHANGE|BOOKING|Documents Pending'), 'VISA_CHANGE', 'BOOKING', 'Documents Pending', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'VISA_CHANGE' AND "scope" = 'BOOKING' AND "name" = 'Booking ID Generated') + 1, 80), false, false, NULL, NULL, 'CONFIRMED', 'DOCUMENTS_REQUESTED', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('VISA_CHANGE|BOOKING|Documents Received'), 'VISA_CHANGE', 'BOOKING', 'Documents Received', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'VISA_CHANGE' AND "scope" = 'BOOKING' AND "name" = 'Documents Pending') + 1, 90), false, false, NULL, NULL, 'CONFIRMED', 'DOCUMENTS_RECEIVED', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('VISA_CHANGE|BOOKING|Documents Verified'), 'VISA_CHANGE', 'BOOKING', 'Documents Verified', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'VISA_CHANGE' AND "scope" = 'BOOKING' AND "name" = 'Documents Received') + 1, 100), false, false, 'Documents Validated', NULL, 'CONFIRMED', 'DOCUMENTS_VALIDATED', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('VISA_CHANGE|BOOKING|Package Generated'), 'VISA_CHANGE', 'BOOKING', 'Package Generated', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'VISA_CHANGE' AND "scope" = 'BOOKING' AND "name" = 'Documents Verified') + 1, 110), false, false, 'Package Generated', NULL, 'PROCESSING', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('VISA_CHANGE|BOOKING|Exit Pending'), 'VISA_CHANGE', 'BOOKING', 'Exit Pending', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'VISA_CHANGE' AND "scope" = 'BOOKING' AND "name" = 'Package Generated') + 1, 120), false, true, NULL, NULL, 'PROCESSING', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('VISA_CHANGE|BOOKING|Exit Completed'), 'VISA_CHANGE', 'BOOKING', 'Exit Completed', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'VISA_CHANGE' AND "scope" = 'BOOKING' AND "name" = 'Exit Pending') + 1, 130), false, true, 'Border Exited', NULL, 'PROCESSING', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('VISA_CHANGE|BOOKING|New Visa Processing'), 'VISA_CHANGE', 'BOOKING', 'New Visa Processing', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'VISA_CHANGE' AND "scope" = 'BOOKING' AND "name" = 'Exit Completed') + 1, 140), false, true, 'New Visa Applied to Embassy', NULL, 'PROCESSING', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('VISA_CHANGE|BOOKING|Additional Documents Required'), 'VISA_CHANGE', 'BOOKING', 'Additional Documents Required', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'VISA_CHANGE' AND "scope" = 'BOOKING' AND "name" = 'New Visa Processing') + 1, 150), false, true, 'Additional Documents Required', NULL, 'PROCESSING', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('VISA_CHANGE|BOOKING|Additional Documents Validated'), 'VISA_CHANGE', 'BOOKING', 'Additional Documents Validated', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'VISA_CHANGE' AND "scope" = 'BOOKING' AND "name" = 'Additional Documents Required') + 1, 160), false, true, 'Additional Documents Validated', NULL, 'PROCESSING', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('VISA_CHANGE|BOOKING|Additional Documents Submitted'), 'VISA_CHANGE', 'BOOKING', 'Additional Documents Submitted', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'VISA_CHANGE' AND "scope" = 'BOOKING' AND "name" = 'Additional Documents Validated') + 1, 170), false, true, 'Additional Documents Submitted', NULL, 'PROCESSING', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('VISA_CHANGE|BOOKING|Visa Approved'), 'VISA_CHANGE', 'BOOKING', 'Visa Approved', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'VISA_CHANGE' AND "scope" = 'BOOKING' AND "name" = 'Additional Documents Submitted') + 1, 180), false, true, 'Visa Approved', NULL, 'PROCESSING', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('VISA_CHANGE|BOOKING|Visa Rejected'), 'VISA_CHANGE', 'BOOKING', 'Visa Rejected', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'VISA_CHANGE' AND "scope" = 'BOOKING' AND "name" = 'Visa Approved') + 1, 190), true, true, 'Rejected', NULL, 'CANCELLED', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('VISA_CHANGE|BOOKING|Visa Delivered'), 'VISA_CHANGE', 'BOOKING', 'Visa Delivered', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'VISA_CHANGE' AND "scope" = 'BOOKING' AND "name" = 'Visa Rejected') + 1, 200), false, true, NULL, NULL, 'PROCESSING', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('VISA_CHANGE|BOOKING|Completed'), 'VISA_CHANGE', 'BOOKING', 'Completed', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'VISA_CHANGE' AND "scope" = 'BOOKING' AND "name" = 'Visa Delivered') + 1, 210), true, true, NULL, NULL, 'COMPLETED', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('VISA_CHANGE|BOOKING|On Hold'), 'VISA_CHANGE', 'BOOKING', 'On Hold', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'VISA_CHANGE' AND "scope" = 'BOOKING' AND "name" = 'Completed') + 1, 220), false, false, NULL, NULL, NULL, 'ON_HOLD', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'BOOKING' AND f."name" = 'Lead Created'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'BOOKING' AND t."name" = 'Availability Check'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'BOOKING' AND f."name" = 'Availability Check'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'BOOKING' AND t."name" = 'Availability Confirmed'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'BOOKING' AND f."name" = 'Availability Confirmed'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'BOOKING' AND t."name" = 'Customer Notified'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'BOOKING' AND f."name" = 'Customer Notified'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'BOOKING' AND t."name" = 'Date/Time/Package Selected'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'BOOKING' AND f."name" = 'Date/Time/Package Selected'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'BOOKING' AND t."name" = 'Payment Pending'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'BOOKING' AND f."name" = 'Payment Pending'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'BOOKING' AND t."name" = 'Payment Received'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'BOOKING' AND f."name" = 'Payment Received'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'BOOKING' AND t."name" = 'Booking ID Generated'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'BOOKING' AND f."name" = 'Booking ID Generated'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'BOOKING' AND t."name" = 'Documents Pending'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'BOOKING' AND f."name" = 'Documents Pending'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'BOOKING' AND t."name" = 'Documents Received'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'BOOKING' AND f."name" = 'Documents Received'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'BOOKING' AND t."name" = 'Documents Verified'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'BOOKING' AND f."name" = 'Documents Verified'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'BOOKING' AND t."name" = 'Package Generated'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'BOOKING' AND f."name" = 'Package Generated'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'BOOKING' AND t."name" = 'Exit Pending'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'BOOKING' AND f."name" = 'Exit Pending'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'BOOKING' AND t."name" = 'Exit Completed'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'BOOKING' AND f."name" = 'Exit Completed'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'BOOKING' AND t."name" = 'New Visa Processing'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'BOOKING' AND f."name" = 'New Visa Processing'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'BOOKING' AND t."name" = 'Additional Documents Required'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'BOOKING' AND f."name" = 'Additional Documents Required'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'BOOKING' AND t."name" = 'Additional Documents Validated'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'BOOKING' AND f."name" = 'Additional Documents Validated'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'BOOKING' AND t."name" = 'Additional Documents Submitted'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'BOOKING' AND f."name" = 'Additional Documents Submitted'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'BOOKING' AND t."name" = 'Visa Approved'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'BOOKING' AND f."name" = 'Visa Approved'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'BOOKING' AND t."name" = 'Visa Rejected'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'BOOKING' AND f."name" = 'Visa Rejected'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'BOOKING' AND t."name" = 'Visa Delivered'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'BOOKING' AND f."name" = 'Visa Delivered'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'BOOKING' AND t."name" = 'Completed'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'BOOKING' AND f."name" = 'New Visa Processing'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'BOOKING' AND t."name" = 'Visa Rejected'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'BOOKING' AND f."name" = 'Lead Created'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'BOOKING' AND t."name" = 'Lead Created'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'BOOKING' AND f."name" = 'Availability Check'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'BOOKING' AND t."name" = 'Availability Check'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'BOOKING' AND f."name" = 'Availability Confirmed'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'BOOKING' AND t."name" = 'Availability Confirmed'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'BOOKING' AND f."name" = 'Customer Notified'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'BOOKING' AND t."name" = 'Customer Notified'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'BOOKING' AND f."name" = 'Date/Time/Package Selected'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'BOOKING' AND t."name" = 'Date/Time/Package Selected'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'BOOKING' AND f."name" = 'Payment Pending'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'BOOKING' AND t."name" = 'Payment Pending'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'BOOKING' AND f."name" = 'Payment Received'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'BOOKING' AND t."name" = 'Payment Received'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'BOOKING' AND f."name" = 'Booking ID Generated'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'BOOKING' AND t."name" = 'Booking ID Generated'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'BOOKING' AND f."name" = 'Documents Pending'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'BOOKING' AND t."name" = 'Documents Pending'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'BOOKING' AND f."name" = 'Documents Received'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'BOOKING' AND t."name" = 'Documents Received'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'BOOKING' AND f."name" = 'Documents Verified'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'BOOKING' AND t."name" = 'Documents Verified'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'BOOKING' AND f."name" = 'Package Generated'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'BOOKING' AND t."name" = 'Package Generated'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'BOOKING' AND f."name" = 'Exit Pending'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'BOOKING' AND t."name" = 'Exit Pending'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'BOOKING' AND f."name" = 'Exit Completed'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'BOOKING' AND t."name" = 'Exit Completed'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'BOOKING' AND f."name" = 'New Visa Processing'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'BOOKING' AND t."name" = 'New Visa Processing'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'BOOKING' AND f."name" = 'Additional Documents Required'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'BOOKING' AND t."name" = 'Additional Documents Required'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'BOOKING' AND f."name" = 'Additional Documents Validated'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'BOOKING' AND t."name" = 'Additional Documents Validated'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'BOOKING' AND f."name" = 'Additional Documents Submitted'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'BOOKING' AND t."name" = 'Additional Documents Submitted'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'BOOKING' AND f."name" = 'Visa Approved'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'BOOKING' AND t."name" = 'Visa Approved'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'BOOKING' AND f."name" = 'Visa Delivered'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'BOOKING' AND t."name" = 'Visa Delivered'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;

-- RETURN_TICKET / BOOKING
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('RETURN_TICKET|BOOKING|Return Ticket Upsell Offered'), 'RETURN_TICKET', 'BOOKING', 'Return Ticket Upsell Offered', NULL, 0, false, false, NULL, NULL, 'PENDING', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('RETURN_TICKET|BOOKING|Application Started'), 'RETURN_TICKET', 'BOOKING', 'Application Started', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'RETURN_TICKET' AND "scope" = 'BOOKING' AND "name" = 'Return Ticket Upsell Offered') + 1, 10), false, false, 'Request Received', NULL, 'PENDING', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('RETURN_TICKET|BOOKING|Payment Pending'), 'RETURN_TICKET', 'BOOKING', 'Payment Pending', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'RETURN_TICKET' AND "scope" = 'BOOKING' AND "name" = 'Application Started') + 1, 20), false, false, NULL, NULL, 'PENDING', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('RETURN_TICKET|BOOKING|Payment Successful'), 'RETURN_TICKET', 'BOOKING', 'Payment Successful', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'RETURN_TICKET' AND "scope" = 'BOOKING' AND "name" = 'Payment Pending') + 1, 30), false, false, NULL, NULL, 'CONFIRMED', 'PAYMENT_SUCCESS', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('RETURN_TICKET|BOOKING|Booking Generated'), 'RETURN_TICKET', 'BOOKING', 'Booking Generated', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'RETURN_TICKET' AND "scope" = 'BOOKING' AND "name" = 'Payment Successful') + 1, 40), false, false, NULL, NULL, 'CONFIRMED', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('RETURN_TICKET|BOOKING|Documents Required'), 'RETURN_TICKET', 'BOOKING', 'Documents Required', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'RETURN_TICKET' AND "scope" = 'BOOKING' AND "name" = 'Booking Generated') + 1, 50), false, false, NULL, NULL, 'CONFIRMED', 'DOCUMENTS_REQUESTED', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('RETURN_TICKET|BOOKING|Document Validation Pending'), 'RETURN_TICKET', 'BOOKING', 'Document Validation Pending', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'RETURN_TICKET' AND "scope" = 'BOOKING' AND "name" = 'Documents Required') + 1, 60), false, false, NULL, NULL, 'CONFIRMED', 'DOCUMENTS_RECEIVED', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('RETURN_TICKET|BOOKING|Documents Validated'), 'RETURN_TICKET', 'BOOKING', 'Documents Validated', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'RETURN_TICKET' AND "scope" = 'BOOKING' AND "name" = 'Document Validation Pending') + 1, 70), false, false, 'Documents Validated', NULL, 'CONFIRMED', 'DOCUMENTS_VALIDATED', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('RETURN_TICKET|BOOKING|Forwarded to Airline / Vendor'), 'RETURN_TICKET', 'BOOKING', 'Forwarded to Airline / Vendor', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'RETURN_TICKET' AND "scope" = 'BOOKING' AND "name" = 'Documents Validated') + 1, 80), false, true, NULL, NULL, 'PROCESSING', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('RETURN_TICKET|BOOKING|Ticket / Reservation Processing'), 'RETURN_TICKET', 'BOOKING', 'Ticket / Reservation Processing', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'RETURN_TICKET' AND "scope" = 'BOOKING' AND "name" = 'Forwarded to Airline / Vendor') + 1, 90), false, true, 'Sent to Airlines', NULL, 'PROCESSING', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('RETURN_TICKET|BOOKING|Ticket Issued'), 'RETURN_TICKET', 'BOOKING', 'Ticket Issued', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'RETURN_TICKET' AND "scope" = 'BOOKING' AND "name" = 'Ticket / Reservation Processing') + 1, 100), false, true, 'Ticket Issued', NULL, 'PROCESSING', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('RETURN_TICKET|BOOKING|Delivered'), 'RETURN_TICKET', 'BOOKING', 'Delivered', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'RETURN_TICKET' AND "scope" = 'BOOKING' AND "name" = 'Ticket Issued') + 1, 110), false, true, NULL, NULL, 'PROCESSING', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('RETURN_TICKET|BOOKING|Completed'), 'RETURN_TICKET', 'BOOKING', 'Completed', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'RETURN_TICKET' AND "scope" = 'BOOKING' AND "name" = 'Delivered') + 1, 120), true, true, NULL, NULL, 'COMPLETED', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('RETURN_TICKET|BOOKING|Customer Cancellation'), 'RETURN_TICKET', 'BOOKING', 'Customer Cancellation', 'Exceptions', COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'RETURN_TICKET' AND "scope" = 'BOOKING' AND "name" = 'Completed') + 1, 130), true, false, NULL, NULL, 'CANCELLED', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('RETURN_TICKET|BOOKING|Refund Processing'), 'RETURN_TICKET', 'BOOKING', 'Refund Processing', 'Exceptions', COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'RETURN_TICKET' AND "scope" = 'BOOKING' AND "name" = 'Customer Cancellation') + 1, 140), false, false, NULL, NULL, 'REFUNDED', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('RETURN_TICKET|BOOKING|Refund Completed'), 'RETURN_TICKET', 'BOOKING', 'Refund Completed', 'Exceptions', COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'RETURN_TICKET' AND "scope" = 'BOOKING' AND "name" = 'Refund Processing') + 1, 150), true, false, NULL, NULL, 'REFUNDED', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('RETURN_TICKET|BOOKING|Unable to Process'), 'RETURN_TICKET', 'BOOKING', 'Unable to Process', 'Exceptions', COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'RETURN_TICKET' AND "scope" = 'BOOKING' AND "name" = 'Refund Completed') + 1, 160), true, false, NULL, NULL, 'CANCELLED', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('RETURN_TICKET|BOOKING|Vendor Issue'), 'RETURN_TICKET', 'BOOKING', 'Vendor Issue', 'Exceptions', COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'RETURN_TICKET' AND "scope" = 'BOOKING' AND "name" = 'Unable to Process') + 1, 170), false, false, NULL, NULL, 'PROCESSING', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('RETURN_TICKET|BOOKING|Expired Reservation'), 'RETURN_TICKET', 'BOOKING', 'Expired Reservation', 'Exceptions', COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'RETURN_TICKET' AND "scope" = 'BOOKING' AND "name" = 'Vendor Issue') + 1, 180), true, false, NULL, NULL, 'CANCELLED', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('RETURN_TICKET|BOOKING|On Hold'), 'RETURN_TICKET', 'BOOKING', 'On Hold', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'RETURN_TICKET' AND "scope" = 'BOOKING' AND "name" = 'Expired Reservation') + 1, 190), false, false, NULL, NULL, NULL, 'ON_HOLD', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'BOOKING' AND f."name" = 'Return Ticket Upsell Offered'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'BOOKING' AND t."name" = 'Application Started'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'BOOKING' AND f."name" = 'Application Started'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'BOOKING' AND t."name" = 'Payment Pending'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'BOOKING' AND f."name" = 'Payment Pending'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'BOOKING' AND t."name" = 'Payment Successful'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'BOOKING' AND f."name" = 'Payment Successful'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'BOOKING' AND t."name" = 'Booking Generated'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'BOOKING' AND f."name" = 'Booking Generated'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'BOOKING' AND t."name" = 'Documents Required'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'BOOKING' AND f."name" = 'Documents Required'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'BOOKING' AND t."name" = 'Document Validation Pending'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'BOOKING' AND f."name" = 'Document Validation Pending'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'BOOKING' AND t."name" = 'Documents Validated'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'BOOKING' AND f."name" = 'Documents Validated'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'BOOKING' AND t."name" = 'Forwarded to Airline / Vendor'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'BOOKING' AND f."name" = 'Forwarded to Airline / Vendor'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'BOOKING' AND t."name" = 'Ticket / Reservation Processing'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'BOOKING' AND f."name" = 'Ticket / Reservation Processing'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'BOOKING' AND t."name" = 'Ticket Issued'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'BOOKING' AND f."name" = 'Ticket Issued'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'BOOKING' AND t."name" = 'Delivered'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'BOOKING' AND f."name" = 'Delivered'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'BOOKING' AND t."name" = 'Completed'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'BOOKING' AND f."name" = 'Customer Cancellation'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'BOOKING' AND t."name" = 'Refund Processing'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'BOOKING' AND f."name" = 'Refund Processing'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'BOOKING' AND t."name" = 'Refund Completed'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'BOOKING' AND f."name" = 'Refund Completed'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'BOOKING' AND t."name" = 'Unable to Process'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'BOOKING' AND f."name" = 'Unable to Process'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'BOOKING' AND t."name" = 'Vendor Issue'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'BOOKING' AND f."name" = 'Vendor Issue'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'BOOKING' AND t."name" = 'Expired Reservation'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'BOOKING' AND f."name" = 'Documents Validated'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'BOOKING' AND t."name" = 'Customer Cancellation'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'BOOKING' AND f."name" = 'Customer Cancellation'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'BOOKING' AND t."name" = 'Refund Processing'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'BOOKING' AND f."name" = 'Ticket / Reservation Processing'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'BOOKING' AND t."name" = 'Vendor Issue'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'BOOKING' AND f."name" = 'Return Ticket Upsell Offered'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'BOOKING' AND t."name" = 'Return Ticket Upsell Offered'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'BOOKING' AND f."name" = 'Application Started'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'BOOKING' AND t."name" = 'Application Started'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'BOOKING' AND f."name" = 'Payment Pending'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'BOOKING' AND t."name" = 'Payment Pending'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'BOOKING' AND f."name" = 'Payment Successful'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'BOOKING' AND t."name" = 'Payment Successful'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'BOOKING' AND f."name" = 'Booking Generated'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'BOOKING' AND t."name" = 'Booking Generated'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'BOOKING' AND f."name" = 'Documents Required'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'BOOKING' AND t."name" = 'Documents Required'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'BOOKING' AND f."name" = 'Document Validation Pending'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'BOOKING' AND t."name" = 'Document Validation Pending'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'BOOKING' AND f."name" = 'Documents Validated'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'BOOKING' AND t."name" = 'Documents Validated'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'BOOKING' AND f."name" = 'Forwarded to Airline / Vendor'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'BOOKING' AND t."name" = 'Forwarded to Airline / Vendor'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'BOOKING' AND f."name" = 'Ticket / Reservation Processing'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'BOOKING' AND t."name" = 'Ticket / Reservation Processing'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'BOOKING' AND f."name" = 'Ticket Issued'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'BOOKING' AND t."name" = 'Ticket Issued'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'BOOKING' AND f."name" = 'Delivered'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'BOOKING' AND t."name" = 'Delivered'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'BOOKING' AND f."name" = 'Refund Processing'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'BOOKING' AND t."name" = 'Refund Processing'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'BOOKING' AND f."name" = 'Vendor Issue'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'BOOKING' AND t."name" = 'Vendor Issue'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;

-- OTB / BOOKING
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('OTB|BOOKING|OTB Upsell Offered'), 'OTB', 'BOOKING', 'OTB Upsell Offered', 'Booking', 0, false, false, NULL, NULL, 'PENDING', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('OTB|BOOKING|OTB Application Started'), 'OTB', 'BOOKING', 'OTB Application Started', 'Booking', COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'OTB' AND "scope" = 'BOOKING' AND "name" = 'OTB Upsell Offered') + 1, 10), false, false, 'OTB Application Received', NULL, 'PENDING', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('OTB|BOOKING|Payment Pending'), 'OTB', 'BOOKING', 'Payment Pending', 'Booking', COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'OTB' AND "scope" = 'BOOKING' AND "name" = 'OTB Application Started') + 1, 20), false, false, NULL, NULL, 'PENDING', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('OTB|BOOKING|Payment Successful'), 'OTB', 'BOOKING', 'Payment Successful', 'Booking', COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'OTB' AND "scope" = 'BOOKING' AND "name" = 'Payment Pending') + 1, 30), false, false, NULL, NULL, 'CONFIRMED', 'PAYMENT_SUCCESS', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('OTB|BOOKING|OTB Booking Generated'), 'OTB', 'BOOKING', 'OTB Booking Generated', 'Booking', COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'OTB' AND "scope" = 'BOOKING' AND "name" = 'Payment Successful') + 1, 40), false, false, NULL, NULL, 'CONFIRMED', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('OTB|BOOKING|Staff Verification Pending'), 'OTB', 'BOOKING', 'Staff Verification Pending', 'Verification', COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'OTB' AND "scope" = 'BOOKING' AND "name" = 'OTB Booking Generated') + 1, 50), false, false, NULL, NULL, 'CONFIRMED', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('OTB|BOOKING|Documents Required'), 'OTB', 'BOOKING', 'Documents Required', 'Verification', COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'OTB' AND "scope" = 'BOOKING' AND "name" = 'Staff Verification Pending') + 1, 60), false, false, 'Documents Upload Pending', NULL, 'CONFIRMED', 'DOCUMENTS_REQUESTED', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('OTB|BOOKING|Document Validation Pending'), 'OTB', 'BOOKING', 'Document Validation Pending', 'Verification', COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'OTB' AND "scope" = 'BOOKING' AND "name" = 'Documents Required') + 1, 70), false, false, NULL, NULL, 'CONFIRMED', 'DOCUMENTS_RECEIVED', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('OTB|BOOKING|Documents Validated'), 'OTB', 'BOOKING', 'Documents Validated', 'Verification', COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'OTB' AND "scope" = 'BOOKING' AND "name" = 'Document Validation Pending') + 1, 80), false, false, 'Documents Validated', NULL, 'CONFIRMED', 'DOCUMENTS_VALIDATED', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('OTB|BOOKING|Ready for Submission'), 'OTB', 'BOOKING', 'Ready for Submission', 'Airline', COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'OTB' AND "scope" = 'BOOKING' AND "name" = 'Documents Validated') + 1, 90), false, false, NULL, NULL, 'CONFIRMED', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('OTB|BOOKING|Submitted to Airline'), 'OTB', 'BOOKING', 'Submitted to Airline', 'Airline', COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'OTB' AND "scope" = 'BOOKING' AND "name" = 'Ready for Submission') + 1, 100), false, true, 'Sent to Airlines', NULL, 'PROCESSING', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('OTB|BOOKING|Airline Processing'), 'OTB', 'BOOKING', 'Airline Processing', 'Airline', COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'OTB' AND "scope" = 'BOOKING' AND "name" = 'Submitted to Airline') + 1, 110), false, true, NULL, NULL, 'PROCESSING', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('OTB|BOOKING|Additional Documents Required'), 'OTB', 'BOOKING', 'Additional Documents Required', 'Airline', COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'OTB' AND "scope" = 'BOOKING' AND "name" = 'Airline Processing') + 1, 120), false, true, 'Additional Documents Required', NULL, 'PROCESSING', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('OTB|BOOKING|Additional Documents Validated'), 'OTB', 'BOOKING', 'Additional Documents Validated', 'Airline', COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'OTB' AND "scope" = 'BOOKING' AND "name" = 'Additional Documents Required') + 1, 130), false, true, 'Additional Documents Validated', NULL, 'PROCESSING', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('OTB|BOOKING|Additional Documents Submitted'), 'OTB', 'BOOKING', 'Additional Documents Submitted', 'Airline', COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'OTB' AND "scope" = 'BOOKING' AND "name" = 'Additional Documents Validated') + 1, 140), false, true, 'Additional Documents Submitted', NULL, 'PROCESSING', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('OTB|BOOKING|OTB Approved'), 'OTB', 'BOOKING', 'OTB Approved', 'Airline', COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'OTB' AND "scope" = 'BOOKING' AND "name" = 'Additional Documents Submitted') + 1, 150), true, true, 'OTB Updated', NULL, 'COMPLETED', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('OTB|BOOKING|OTB Rejected'), 'OTB', 'BOOKING', 'OTB Rejected', 'Airline', COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'OTB' AND "scope" = 'BOOKING' AND "name" = 'OTB Approved') + 1, 160), true, true, NULL, NULL, 'CANCELLED', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('OTB|BOOKING|OTB Not Required'), 'OTB', 'BOOKING', 'OTB Not Required', 'Exceptions', COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'OTB' AND "scope" = 'BOOKING' AND "name" = 'OTB Rejected') + 1, 170), true, false, NULL, NULL, 'CANCELLED', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('OTB|BOOKING|Unable to Process'), 'OTB', 'BOOKING', 'Unable to Process', 'Exceptions', COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'OTB' AND "scope" = 'BOOKING' AND "name" = 'OTB Not Required') + 1, 180), true, false, NULL, NULL, 'CANCELLED', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('OTB|BOOKING|Cancelled'), 'OTB', 'BOOKING', 'Cancelled', 'Exceptions', COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'OTB' AND "scope" = 'BOOKING' AND "name" = 'Unable to Process') + 1, 190), true, false, NULL, NULL, 'CANCELLED', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('OTB|BOOKING|Refund Processing'), 'OTB', 'BOOKING', 'Refund Processing', 'Exceptions', COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'OTB' AND "scope" = 'BOOKING' AND "name" = 'Cancelled') + 1, 200), false, false, NULL, NULL, 'REFUNDED', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('OTB|BOOKING|Refund Completed'), 'OTB', 'BOOKING', 'Refund Completed', 'Exceptions', COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'OTB' AND "scope" = 'BOOKING' AND "name" = 'Refund Processing') + 1, 210), true, false, NULL, NULL, 'REFUNDED', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('OTB|BOOKING|On Hold'), 'OTB', 'BOOKING', 'On Hold', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'OTB' AND "scope" = 'BOOKING' AND "name" = 'Refund Completed') + 1, 220), false, false, NULL, NULL, NULL, 'ON_HOLD', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'BOOKING' AND f."name" = 'OTB Upsell Offered'
  AND t."serviceType" = 'OTB' AND t."scope" = 'BOOKING' AND t."name" = 'OTB Application Started'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'BOOKING' AND f."name" = 'OTB Application Started'
  AND t."serviceType" = 'OTB' AND t."scope" = 'BOOKING' AND t."name" = 'Payment Pending'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'BOOKING' AND f."name" = 'Payment Pending'
  AND t."serviceType" = 'OTB' AND t."scope" = 'BOOKING' AND t."name" = 'Payment Successful'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'BOOKING' AND f."name" = 'Payment Successful'
  AND t."serviceType" = 'OTB' AND t."scope" = 'BOOKING' AND t."name" = 'OTB Booking Generated'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'BOOKING' AND f."name" = 'Staff Verification Pending'
  AND t."serviceType" = 'OTB' AND t."scope" = 'BOOKING' AND t."name" = 'Documents Required'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'BOOKING' AND f."name" = 'Documents Required'
  AND t."serviceType" = 'OTB' AND t."scope" = 'BOOKING' AND t."name" = 'Document Validation Pending'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'BOOKING' AND f."name" = 'Document Validation Pending'
  AND t."serviceType" = 'OTB' AND t."scope" = 'BOOKING' AND t."name" = 'Documents Validated'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'BOOKING' AND f."name" = 'Ready for Submission'
  AND t."serviceType" = 'OTB' AND t."scope" = 'BOOKING' AND t."name" = 'Submitted to Airline'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'BOOKING' AND f."name" = 'Submitted to Airline'
  AND t."serviceType" = 'OTB' AND t."scope" = 'BOOKING' AND t."name" = 'Airline Processing'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'BOOKING' AND f."name" = 'Airline Processing'
  AND t."serviceType" = 'OTB' AND t."scope" = 'BOOKING' AND t."name" = 'Additional Documents Required'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'BOOKING' AND f."name" = 'Additional Documents Required'
  AND t."serviceType" = 'OTB' AND t."scope" = 'BOOKING' AND t."name" = 'Additional Documents Validated'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'BOOKING' AND f."name" = 'Additional Documents Validated'
  AND t."serviceType" = 'OTB' AND t."scope" = 'BOOKING' AND t."name" = 'Additional Documents Submitted'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'BOOKING' AND f."name" = 'Additional Documents Submitted'
  AND t."serviceType" = 'OTB' AND t."scope" = 'BOOKING' AND t."name" = 'OTB Approved'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'BOOKING' AND f."name" = 'OTB Approved'
  AND t."serviceType" = 'OTB' AND t."scope" = 'BOOKING' AND t."name" = 'OTB Rejected'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'BOOKING' AND f."name" = 'OTB Not Required'
  AND t."serviceType" = 'OTB' AND t."scope" = 'BOOKING' AND t."name" = 'Unable to Process'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'BOOKING' AND f."name" = 'Unable to Process'
  AND t."serviceType" = 'OTB' AND t."scope" = 'BOOKING' AND t."name" = 'Cancelled'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'BOOKING' AND f."name" = 'Cancelled'
  AND t."serviceType" = 'OTB' AND t."scope" = 'BOOKING' AND t."name" = 'Refund Processing'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'BOOKING' AND f."name" = 'Refund Processing'
  AND t."serviceType" = 'OTB' AND t."scope" = 'BOOKING' AND t."name" = 'Refund Completed'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'BOOKING' AND f."name" = 'OTB Booking Generated'
  AND t."serviceType" = 'OTB' AND t."scope" = 'BOOKING' AND t."name" = 'Staff Verification Pending'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'BOOKING' AND f."name" = 'Documents Validated'
  AND t."serviceType" = 'OTB' AND t."scope" = 'BOOKING' AND t."name" = 'Ready for Submission'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'BOOKING' AND f."name" = 'OTB Rejected'
  AND t."serviceType" = 'OTB' AND t."scope" = 'BOOKING' AND t."name" = 'Refund Processing'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'BOOKING' AND f."name" = 'Cancelled'
  AND t."serviceType" = 'OTB' AND t."scope" = 'BOOKING' AND t."name" = 'Refund Processing'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'BOOKING' AND f."name" = 'OTB Upsell Offered'
  AND t."serviceType" = 'OTB' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'OTB' AND t."scope" = 'BOOKING' AND t."name" = 'OTB Upsell Offered'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'BOOKING' AND f."name" = 'OTB Application Started'
  AND t."serviceType" = 'OTB' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'OTB' AND t."scope" = 'BOOKING' AND t."name" = 'OTB Application Started'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'BOOKING' AND f."name" = 'Payment Pending'
  AND t."serviceType" = 'OTB' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'OTB' AND t."scope" = 'BOOKING' AND t."name" = 'Payment Pending'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'BOOKING' AND f."name" = 'Payment Successful'
  AND t."serviceType" = 'OTB' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'OTB' AND t."scope" = 'BOOKING' AND t."name" = 'Payment Successful'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'BOOKING' AND f."name" = 'OTB Booking Generated'
  AND t."serviceType" = 'OTB' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'OTB' AND t."scope" = 'BOOKING' AND t."name" = 'OTB Booking Generated'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'BOOKING' AND f."name" = 'Staff Verification Pending'
  AND t."serviceType" = 'OTB' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'OTB' AND t."scope" = 'BOOKING' AND t."name" = 'Staff Verification Pending'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'BOOKING' AND f."name" = 'Documents Required'
  AND t."serviceType" = 'OTB' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'OTB' AND t."scope" = 'BOOKING' AND t."name" = 'Documents Required'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'BOOKING' AND f."name" = 'Document Validation Pending'
  AND t."serviceType" = 'OTB' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'OTB' AND t."scope" = 'BOOKING' AND t."name" = 'Document Validation Pending'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'BOOKING' AND f."name" = 'Documents Validated'
  AND t."serviceType" = 'OTB' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'OTB' AND t."scope" = 'BOOKING' AND t."name" = 'Documents Validated'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'BOOKING' AND f."name" = 'Ready for Submission'
  AND t."serviceType" = 'OTB' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'OTB' AND t."scope" = 'BOOKING' AND t."name" = 'Ready for Submission'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'BOOKING' AND f."name" = 'Submitted to Airline'
  AND t."serviceType" = 'OTB' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'OTB' AND t."scope" = 'BOOKING' AND t."name" = 'Submitted to Airline'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'BOOKING' AND f."name" = 'Airline Processing'
  AND t."serviceType" = 'OTB' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'OTB' AND t."scope" = 'BOOKING' AND t."name" = 'Airline Processing'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'BOOKING' AND f."name" = 'Additional Documents Required'
  AND t."serviceType" = 'OTB' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'OTB' AND t."scope" = 'BOOKING' AND t."name" = 'Additional Documents Required'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'BOOKING' AND f."name" = 'Additional Documents Validated'
  AND t."serviceType" = 'OTB' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'OTB' AND t."scope" = 'BOOKING' AND t."name" = 'Additional Documents Validated'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'BOOKING' AND f."name" = 'Additional Documents Submitted'
  AND t."serviceType" = 'OTB' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'OTB' AND t."scope" = 'BOOKING' AND t."name" = 'Additional Documents Submitted'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'BOOKING' AND f."name" = 'Refund Processing'
  AND t."serviceType" = 'OTB' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'OTB' AND t."scope" = 'BOOKING' AND t."name" = 'Refund Processing'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;

-- FLIGHT_SPECIAL_FARE / BOOKING
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('FLIGHT_SPECIAL_FARE|BOOKING|New'), 'FLIGHT_SPECIAL_FARE', 'BOOKING', 'New', NULL, 0, false, false, NULL, NULL, 'PENDING', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('FLIGHT_SPECIAL_FARE|BOOKING|Availability Pending'), 'FLIGHT_SPECIAL_FARE', 'BOOKING', 'Availability Pending', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'FLIGHT_SPECIAL_FARE' AND "scope" = 'BOOKING' AND "name" = 'New') + 1, 10), false, false, NULL, NULL, 'PENDING', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('FLIGHT_SPECIAL_FARE|BOOKING|Quote Sent'), 'FLIGHT_SPECIAL_FARE', 'BOOKING', 'Quote Sent', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'FLIGHT_SPECIAL_FARE' AND "scope" = 'BOOKING' AND "name" = 'Availability Pending') + 1, 20), false, false, NULL, NULL, 'PENDING', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('FLIGHT_SPECIAL_FARE|BOOKING|Quote Viewed'), 'FLIGHT_SPECIAL_FARE', 'BOOKING', 'Quote Viewed', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'FLIGHT_SPECIAL_FARE' AND "scope" = 'BOOKING' AND "name" = 'Quote Sent') + 1, 30), false, false, NULL, NULL, 'PENDING', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('FLIGHT_SPECIAL_FARE|BOOKING|Expiring'), 'FLIGHT_SPECIAL_FARE', 'BOOKING', 'Expiring', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'FLIGHT_SPECIAL_FARE' AND "scope" = 'BOOKING' AND "name" = 'Quote Viewed') + 1, 40), false, false, NULL, NULL, 'PENDING', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('FLIGHT_SPECIAL_FARE|BOOKING|Expired'), 'FLIGHT_SPECIAL_FARE', 'BOOKING', 'Expired', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'FLIGHT_SPECIAL_FARE' AND "scope" = 'BOOKING' AND "name" = 'Expiring') + 1, 50), true, false, NULL, NULL, 'CANCELLED', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('FLIGHT_SPECIAL_FARE|BOOKING|New Quote Requested'), 'FLIGHT_SPECIAL_FARE', 'BOOKING', 'New Quote Requested', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'FLIGHT_SPECIAL_FARE' AND "scope" = 'BOOKING' AND "name" = 'Expired') + 1, 60), false, false, NULL, NULL, 'PENDING', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('FLIGHT_SPECIAL_FARE|BOOKING|Payment Pending'), 'FLIGHT_SPECIAL_FARE', 'BOOKING', 'Payment Pending', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'FLIGHT_SPECIAL_FARE' AND "scope" = 'BOOKING' AND "name" = 'New Quote Requested') + 1, 70), false, false, 'Quotation Approved', NULL, 'PENDING', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('FLIGHT_SPECIAL_FARE|BOOKING|Paid'), 'FLIGHT_SPECIAL_FARE', 'BOOKING', 'Paid', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'FLIGHT_SPECIAL_FARE' AND "scope" = 'BOOKING' AND "name" = 'Payment Pending') + 1, 80), false, false, 'Payment Completed', NULL, 'CONFIRMED', 'PAYMENT_SUCCESS', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('FLIGHT_SPECIAL_FARE|BOOKING|Final Confirmation'), 'FLIGHT_SPECIAL_FARE', 'BOOKING', 'Final Confirmation', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'FLIGHT_SPECIAL_FARE' AND "scope" = 'BOOKING' AND "name" = 'Paid') + 1, 90), false, false, NULL, NULL, 'CONFIRMED', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('FLIGHT_SPECIAL_FARE|BOOKING|Documents Validated'), 'FLIGHT_SPECIAL_FARE', 'BOOKING', 'Documents Validated', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'FLIGHT_SPECIAL_FARE' AND "scope" = 'BOOKING' AND "name" = 'Final Confirmation') + 1, 100), false, false, 'Documents Validated', NULL, 'CONFIRMED', 'DOCUMENTS_VALIDATED', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('FLIGHT_SPECIAL_FARE|BOOKING|Sent to Airlines'), 'FLIGHT_SPECIAL_FARE', 'BOOKING', 'Sent to Airlines', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'FLIGHT_SPECIAL_FARE' AND "scope" = 'BOOKING' AND "name" = 'Documents Validated') + 1, 110), false, false, 'Sent to Airlines', NULL, 'PROCESSING', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('FLIGHT_SPECIAL_FARE|BOOKING|Alternative Offered'), 'FLIGHT_SPECIAL_FARE', 'BOOKING', 'Alternative Offered', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'FLIGHT_SPECIAL_FARE' AND "scope" = 'BOOKING' AND "name" = 'Sent to Airlines') + 1, 120), false, false, NULL, NULL, 'PENDING', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('FLIGHT_SPECIAL_FARE|BOOKING|Additional Payment Pending'), 'FLIGHT_SPECIAL_FARE', 'BOOKING', 'Additional Payment Pending', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'FLIGHT_SPECIAL_FARE' AND "scope" = 'BOOKING' AND "name" = 'Alternative Offered') + 1, 130), false, false, NULL, NULL, 'CONFIRMED', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('FLIGHT_SPECIAL_FARE|BOOKING|Refund Pending'), 'FLIGHT_SPECIAL_FARE', 'BOOKING', 'Refund Pending', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'FLIGHT_SPECIAL_FARE' AND "scope" = 'BOOKING' AND "name" = 'Additional Payment Pending') + 1, 140), false, false, NULL, NULL, 'REFUNDED', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('FLIGHT_SPECIAL_FARE|BOOKING|Ticket Issued'), 'FLIGHT_SPECIAL_FARE', 'BOOKING', 'Ticket Issued', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'FLIGHT_SPECIAL_FARE' AND "scope" = 'BOOKING' AND "name" = 'Refund Pending') + 1, 150), true, false, 'Ticket Issued', NULL, 'COMPLETED', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('FLIGHT_SPECIAL_FARE|BOOKING|Cancelled'), 'FLIGHT_SPECIAL_FARE', 'BOOKING', 'Cancelled', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'FLIGHT_SPECIAL_FARE' AND "scope" = 'BOOKING' AND "name" = 'Ticket Issued') + 1, 160), true, false, NULL, NULL, 'CANCELLED', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('FLIGHT_SPECIAL_FARE|BOOKING|Follow-up Due'), 'FLIGHT_SPECIAL_FARE', 'BOOKING', 'Follow-up Due', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'FLIGHT_SPECIAL_FARE' AND "scope" = 'BOOKING' AND "name" = 'Cancelled') + 1, 170), false, false, NULL, NULL, 'PENDING', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('FLIGHT_SPECIAL_FARE|BOOKING|On Hold'), 'FLIGHT_SPECIAL_FARE', 'BOOKING', 'On Hold', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'FLIGHT_SPECIAL_FARE' AND "scope" = 'BOOKING' AND "name" = 'Follow-up Due') + 1, 180), false, false, NULL, NULL, NULL, 'ON_HOLD', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'BOOKING' AND f."name" = 'New'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'BOOKING' AND t."name" = 'Availability Pending'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'BOOKING' AND f."name" = 'Availability Pending'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'BOOKING' AND t."name" = 'Quote Sent'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'BOOKING' AND f."name" = 'Quote Sent'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'BOOKING' AND t."name" = 'Quote Viewed'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'BOOKING' AND f."name" = 'Quote Viewed'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'BOOKING' AND t."name" = 'Expiring'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'BOOKING' AND f."name" = 'Expiring'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'BOOKING' AND t."name" = 'Expired'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'BOOKING' AND f."name" = 'Expired'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'BOOKING' AND t."name" = 'New Quote Requested'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'BOOKING' AND f."name" = 'New Quote Requested'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'BOOKING' AND t."name" = 'Payment Pending'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'BOOKING' AND f."name" = 'Payment Pending'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'BOOKING' AND t."name" = 'Paid'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'BOOKING' AND f."name" = 'Paid'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'BOOKING' AND t."name" = 'Final Confirmation'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'BOOKING' AND f."name" = 'Final Confirmation'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'BOOKING' AND t."name" = 'Alternative Offered'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'BOOKING' AND f."name" = 'Alternative Offered'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'BOOKING' AND t."name" = 'Additional Payment Pending'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'BOOKING' AND f."name" = 'Additional Payment Pending'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'BOOKING' AND t."name" = 'Refund Pending'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'BOOKING' AND f."name" = 'Refund Pending'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'BOOKING' AND t."name" = 'Ticket Issued'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'BOOKING' AND f."name" = 'Ticket Issued'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'BOOKING' AND t."name" = 'Cancelled'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'BOOKING' AND f."name" = 'Cancelled'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'BOOKING' AND t."name" = 'Follow-up Due'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'BOOKING' AND f."name" = 'Quote Sent'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'BOOKING' AND t."name" = 'Expiring'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'BOOKING' AND f."name" = 'Quote Viewed'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'BOOKING' AND t."name" = 'Expiring'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'BOOKING' AND f."name" = 'Expiring'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'BOOKING' AND t."name" = 'Expired'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'BOOKING' AND f."name" = 'Expiring'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'BOOKING' AND t."name" = 'New Quote Requested'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'BOOKING' AND f."name" = 'Final Confirmation'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'BOOKING' AND t."name" = 'Alternative Offered'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'BOOKING' AND f."name" = 'Final Confirmation'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'BOOKING' AND t."name" = 'Additional Payment Pending'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'BOOKING' AND f."name" = 'Paid'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'BOOKING' AND t."name" = 'Cancelled'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'BOOKING' AND f."name" = 'Cancelled'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'BOOKING' AND t."name" = 'Refund Pending'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'BOOKING' AND f."name" = 'Quote Sent'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'BOOKING' AND t."name" = 'Follow-up Due'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'BOOKING' AND f."name" = 'Paid'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'BOOKING' AND t."name" = 'Documents Validated'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'BOOKING' AND f."name" = 'Final Confirmation'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'BOOKING' AND t."name" = 'Documents Validated'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'BOOKING' AND f."name" = 'Documents Validated'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'BOOKING' AND t."name" = 'Sent to Airlines'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'BOOKING' AND f."name" = 'Sent to Airlines'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'BOOKING' AND t."name" = 'Ticket Issued'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'BOOKING' AND f."name" = 'Sent to Airlines'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'BOOKING' AND t."name" = 'Cancelled'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'BOOKING' AND f."name" = 'New'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'BOOKING' AND t."name" = 'New'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'BOOKING' AND f."name" = 'Availability Pending'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'BOOKING' AND t."name" = 'Availability Pending'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'BOOKING' AND f."name" = 'Quote Sent'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'BOOKING' AND t."name" = 'Quote Sent'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'BOOKING' AND f."name" = 'Quote Viewed'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'BOOKING' AND t."name" = 'Quote Viewed'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'BOOKING' AND f."name" = 'Expiring'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'BOOKING' AND t."name" = 'Expiring'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'BOOKING' AND f."name" = 'New Quote Requested'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'BOOKING' AND t."name" = 'New Quote Requested'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'BOOKING' AND f."name" = 'Payment Pending'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'BOOKING' AND t."name" = 'Payment Pending'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'BOOKING' AND f."name" = 'Paid'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'BOOKING' AND t."name" = 'Paid'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'BOOKING' AND f."name" = 'Final Confirmation'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'BOOKING' AND t."name" = 'Final Confirmation'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'BOOKING' AND f."name" = 'Documents Validated'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'BOOKING' AND t."name" = 'Documents Validated'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'BOOKING' AND f."name" = 'Sent to Airlines'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'BOOKING' AND t."name" = 'Sent to Airlines'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'BOOKING' AND f."name" = 'Alternative Offered'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'BOOKING' AND t."name" = 'Alternative Offered'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'BOOKING' AND f."name" = 'Additional Payment Pending'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'BOOKING' AND t."name" = 'Additional Payment Pending'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'BOOKING' AND f."name" = 'Refund Pending'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'BOOKING' AND t."name" = 'Refund Pending'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'BOOKING' AND f."name" = 'Follow-up Due'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'BOOKING' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'BOOKING' AND f."name" = 'On Hold'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'BOOKING' AND t."name" = 'Follow-up Due'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;

-- NEW_VISA / LEAD
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('NEW_VISA|LEAD|New'), 'NEW_VISA', 'LEAD', 'New', NULL, 0, false, false, NULL, 'NEW', NULL, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('NEW_VISA|LEAD|Contacted'), 'NEW_VISA', 'LEAD', 'Contacted', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'NEW_VISA' AND "scope" = 'LEAD' AND "name" = 'New') + 1, 10), false, false, NULL, 'CONTACTED', NULL, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('NEW_VISA|LEAD|Follow-up Required'), 'NEW_VISA', 'LEAD', 'Follow-up Required', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'NEW_VISA' AND "scope" = 'LEAD' AND "name" = 'Contacted') + 1, 20), false, false, NULL, 'FOLLOW_UP_REQUIRED', NULL, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('NEW_VISA|LEAD|Customer Responded'), 'NEW_VISA', 'LEAD', 'Customer Responded', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'NEW_VISA' AND "scope" = 'LEAD' AND "name" = 'Follow-up Required') + 1, 30), false, false, NULL, 'CUSTOMER_RESPONDED', NULL, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('NEW_VISA|LEAD|Qualified'), 'NEW_VISA', 'LEAD', 'Qualified', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'NEW_VISA' AND "scope" = 'LEAD' AND "name" = 'Customer Responded') + 1, 40), false, false, NULL, 'QUALIFIED', NULL, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('NEW_VISA|LEAD|Quotation Created'), 'NEW_VISA', 'LEAD', 'Quotation Created', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'NEW_VISA' AND "scope" = 'LEAD' AND "name" = 'Qualified') + 1, 50), false, false, NULL, 'QUOTATION_CREATED', NULL, 'QUOTATION_CREATED', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('NEW_VISA|LEAD|Quotation Accepted'), 'NEW_VISA', 'LEAD', 'Quotation Accepted', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'NEW_VISA' AND "scope" = 'LEAD' AND "name" = 'Quotation Created') + 1, 60), false, false, NULL, 'QUOTATION_ACCEPTED', NULL, 'QUOTATION_ACCEPTED', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('NEW_VISA|LEAD|Payment Pending'), 'NEW_VISA', 'LEAD', 'Payment Pending', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'NEW_VISA' AND "scope" = 'LEAD' AND "name" = 'Quotation Accepted') + 1, 70), false, false, NULL, 'PAYMENT_PENDING', NULL, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('NEW_VISA|LEAD|Converted'), 'NEW_VISA', 'LEAD', 'Converted', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'NEW_VISA' AND "scope" = 'LEAD' AND "name" = 'Payment Pending') + 1, 80), true, false, NULL, 'CONVERTED', NULL, 'PAYMENT_SUCCESS', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('NEW_VISA|LEAD|Lost'), 'NEW_VISA', 'LEAD', 'Lost', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'NEW_VISA' AND "scope" = 'LEAD' AND "name" = 'Converted') + 1, 90), true, false, NULL, 'LOST', NULL, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('NEW_VISA|LEAD|Closed'), 'NEW_VISA', 'LEAD', 'Closed', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'NEW_VISA' AND "scope" = 'LEAD' AND "name" = 'Lost') + 1, 100), true, false, NULL, 'CLOSED', NULL, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('NEW_VISA|LEAD|On Hold'), 'NEW_VISA', 'LEAD', 'On Hold', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'NEW_VISA' AND "scope" = 'LEAD' AND "name" = 'Closed') + 1, 110), false, false, NULL, NULL, NULL, 'ON_HOLD', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'LEAD' AND f."name" = 'New'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'LEAD' AND t."name" = 'Contacted'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'LEAD' AND f."name" = 'New'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'LEAD' AND t."name" = 'Follow-up Required'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'LEAD' AND f."name" = 'New'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'LEAD' AND t."name" = 'Lost'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'LEAD' AND f."name" = 'New'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'LEAD' AND t."name" = 'Closed'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'LEAD' AND f."name" = 'Contacted'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'LEAD' AND t."name" = 'Follow-up Required'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'LEAD' AND f."name" = 'Contacted'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'LEAD' AND t."name" = 'Customer Responded'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'LEAD' AND f."name" = 'Contacted'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'LEAD' AND t."name" = 'Qualified'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'LEAD' AND f."name" = 'Contacted'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'LEAD' AND t."name" = 'Lost'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'LEAD' AND f."name" = 'Contacted'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'LEAD' AND t."name" = 'Closed'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'LEAD' AND f."name" = 'Follow-up Required'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'LEAD' AND t."name" = 'Contacted'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'LEAD' AND f."name" = 'Follow-up Required'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'LEAD' AND t."name" = 'Customer Responded'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'LEAD' AND f."name" = 'Follow-up Required'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'LEAD' AND t."name" = 'Qualified'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'LEAD' AND f."name" = 'Follow-up Required'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'LEAD' AND t."name" = 'Lost'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'LEAD' AND f."name" = 'Follow-up Required'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'LEAD' AND t."name" = 'Closed'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'LEAD' AND f."name" = 'Customer Responded'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'LEAD' AND t."name" = 'Qualified'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'LEAD' AND f."name" = 'Customer Responded'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'LEAD' AND t."name" = 'Follow-up Required'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'LEAD' AND f."name" = 'Customer Responded'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'LEAD' AND t."name" = 'Lost'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'LEAD' AND f."name" = 'Customer Responded'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'LEAD' AND t."name" = 'Closed'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'LEAD' AND f."name" = 'Qualified'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'LEAD' AND t."name" = 'Quotation Created'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'LEAD' AND f."name" = 'Qualified'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'LEAD' AND t."name" = 'Follow-up Required'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'LEAD' AND f."name" = 'Qualified'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'LEAD' AND t."name" = 'Lost'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'LEAD' AND f."name" = 'Qualified'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'LEAD' AND t."name" = 'Closed'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'LEAD' AND f."name" = 'Quotation Created'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'LEAD' AND t."name" = 'Quotation Accepted'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'LEAD' AND f."name" = 'Quotation Created'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'LEAD' AND t."name" = 'Follow-up Required'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'LEAD' AND f."name" = 'Quotation Created'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'LEAD' AND t."name" = 'Lost'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'LEAD' AND f."name" = 'Quotation Created'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'LEAD' AND t."name" = 'Closed'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'LEAD' AND f."name" = 'Quotation Accepted'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'LEAD' AND t."name" = 'Payment Pending'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'LEAD' AND f."name" = 'Quotation Accepted'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'LEAD' AND t."name" = 'Follow-up Required'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'LEAD' AND f."name" = 'Quotation Accepted'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'LEAD' AND t."name" = 'Lost'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'LEAD' AND f."name" = 'Quotation Accepted'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'LEAD' AND t."name" = 'Closed'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'LEAD' AND f."name" = 'Payment Pending'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'LEAD' AND t."name" = 'Converted'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'LEAD' AND f."name" = 'Payment Pending'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'LEAD' AND t."name" = 'Follow-up Required'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'LEAD' AND f."name" = 'Payment Pending'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'LEAD' AND t."name" = 'Lost'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'LEAD' AND f."name" = 'Payment Pending'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'LEAD' AND t."name" = 'Closed'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'LEAD' AND f."name" = 'New'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'LEAD' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'LEAD' AND f."name" = 'On Hold'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'LEAD' AND t."name" = 'New'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'LEAD' AND f."name" = 'Contacted'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'LEAD' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'LEAD' AND f."name" = 'On Hold'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'LEAD' AND t."name" = 'Contacted'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'LEAD' AND f."name" = 'Follow-up Required'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'LEAD' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'LEAD' AND f."name" = 'On Hold'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'LEAD' AND t."name" = 'Follow-up Required'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'LEAD' AND f."name" = 'Customer Responded'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'LEAD' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'LEAD' AND f."name" = 'On Hold'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'LEAD' AND t."name" = 'Customer Responded'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'LEAD' AND f."name" = 'Qualified'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'LEAD' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'LEAD' AND f."name" = 'On Hold'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'LEAD' AND t."name" = 'Qualified'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'LEAD' AND f."name" = 'Quotation Created'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'LEAD' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'LEAD' AND f."name" = 'On Hold'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'LEAD' AND t."name" = 'Quotation Created'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'LEAD' AND f."name" = 'Quotation Accepted'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'LEAD' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'LEAD' AND f."name" = 'On Hold'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'LEAD' AND t."name" = 'Quotation Accepted'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'LEAD' AND f."name" = 'Payment Pending'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'LEAD' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'NEW_VISA' AND f."scope" = 'LEAD' AND f."name" = 'On Hold'
  AND t."serviceType" = 'NEW_VISA' AND t."scope" = 'LEAD' AND t."name" = 'Payment Pending'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;

-- VISA_EXTENSION / LEAD
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('VISA_EXTENSION|LEAD|New'), 'VISA_EXTENSION', 'LEAD', 'New', NULL, 0, false, false, NULL, 'NEW', NULL, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('VISA_EXTENSION|LEAD|Contacted'), 'VISA_EXTENSION', 'LEAD', 'Contacted', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'VISA_EXTENSION' AND "scope" = 'LEAD' AND "name" = 'New') + 1, 10), false, false, NULL, 'CONTACTED', NULL, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('VISA_EXTENSION|LEAD|Follow-up Required'), 'VISA_EXTENSION', 'LEAD', 'Follow-up Required', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'VISA_EXTENSION' AND "scope" = 'LEAD' AND "name" = 'Contacted') + 1, 20), false, false, NULL, 'FOLLOW_UP_REQUIRED', NULL, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('VISA_EXTENSION|LEAD|Customer Responded'), 'VISA_EXTENSION', 'LEAD', 'Customer Responded', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'VISA_EXTENSION' AND "scope" = 'LEAD' AND "name" = 'Follow-up Required') + 1, 30), false, false, NULL, 'CUSTOMER_RESPONDED', NULL, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('VISA_EXTENSION|LEAD|Qualified'), 'VISA_EXTENSION', 'LEAD', 'Qualified', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'VISA_EXTENSION' AND "scope" = 'LEAD' AND "name" = 'Customer Responded') + 1, 40), false, false, NULL, 'QUALIFIED', NULL, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('VISA_EXTENSION|LEAD|Quotation Created'), 'VISA_EXTENSION', 'LEAD', 'Quotation Created', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'VISA_EXTENSION' AND "scope" = 'LEAD' AND "name" = 'Qualified') + 1, 50), false, false, NULL, 'QUOTATION_CREATED', NULL, 'QUOTATION_CREATED', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('VISA_EXTENSION|LEAD|Quotation Accepted'), 'VISA_EXTENSION', 'LEAD', 'Quotation Accepted', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'VISA_EXTENSION' AND "scope" = 'LEAD' AND "name" = 'Quotation Created') + 1, 60), false, false, NULL, 'QUOTATION_ACCEPTED', NULL, 'QUOTATION_ACCEPTED', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('VISA_EXTENSION|LEAD|Payment Pending'), 'VISA_EXTENSION', 'LEAD', 'Payment Pending', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'VISA_EXTENSION' AND "scope" = 'LEAD' AND "name" = 'Quotation Accepted') + 1, 70), false, false, NULL, 'PAYMENT_PENDING', NULL, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('VISA_EXTENSION|LEAD|Converted'), 'VISA_EXTENSION', 'LEAD', 'Converted', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'VISA_EXTENSION' AND "scope" = 'LEAD' AND "name" = 'Payment Pending') + 1, 80), true, false, NULL, 'CONVERTED', NULL, 'PAYMENT_SUCCESS', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('VISA_EXTENSION|LEAD|Lost'), 'VISA_EXTENSION', 'LEAD', 'Lost', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'VISA_EXTENSION' AND "scope" = 'LEAD' AND "name" = 'Converted') + 1, 90), true, false, NULL, 'LOST', NULL, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('VISA_EXTENSION|LEAD|Closed'), 'VISA_EXTENSION', 'LEAD', 'Closed', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'VISA_EXTENSION' AND "scope" = 'LEAD' AND "name" = 'Lost') + 1, 100), true, false, NULL, 'CLOSED', NULL, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('VISA_EXTENSION|LEAD|On Hold'), 'VISA_EXTENSION', 'LEAD', 'On Hold', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'VISA_EXTENSION' AND "scope" = 'LEAD' AND "name" = 'Closed') + 1, 110), false, false, NULL, NULL, NULL, 'ON_HOLD', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'LEAD' AND f."name" = 'New'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'LEAD' AND t."name" = 'Contacted'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'LEAD' AND f."name" = 'New'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'LEAD' AND t."name" = 'Follow-up Required'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'LEAD' AND f."name" = 'New'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'LEAD' AND t."name" = 'Lost'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'LEAD' AND f."name" = 'New'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'LEAD' AND t."name" = 'Closed'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'LEAD' AND f."name" = 'Contacted'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'LEAD' AND t."name" = 'Follow-up Required'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'LEAD' AND f."name" = 'Contacted'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'LEAD' AND t."name" = 'Customer Responded'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'LEAD' AND f."name" = 'Contacted'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'LEAD' AND t."name" = 'Qualified'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'LEAD' AND f."name" = 'Contacted'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'LEAD' AND t."name" = 'Lost'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'LEAD' AND f."name" = 'Contacted'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'LEAD' AND t."name" = 'Closed'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'LEAD' AND f."name" = 'Follow-up Required'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'LEAD' AND t."name" = 'Contacted'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'LEAD' AND f."name" = 'Follow-up Required'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'LEAD' AND t."name" = 'Customer Responded'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'LEAD' AND f."name" = 'Follow-up Required'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'LEAD' AND t."name" = 'Qualified'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'LEAD' AND f."name" = 'Follow-up Required'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'LEAD' AND t."name" = 'Lost'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'LEAD' AND f."name" = 'Follow-up Required'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'LEAD' AND t."name" = 'Closed'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'LEAD' AND f."name" = 'Customer Responded'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'LEAD' AND t."name" = 'Qualified'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'LEAD' AND f."name" = 'Customer Responded'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'LEAD' AND t."name" = 'Follow-up Required'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'LEAD' AND f."name" = 'Customer Responded'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'LEAD' AND t."name" = 'Lost'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'LEAD' AND f."name" = 'Customer Responded'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'LEAD' AND t."name" = 'Closed'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'LEAD' AND f."name" = 'Qualified'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'LEAD' AND t."name" = 'Quotation Created'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'LEAD' AND f."name" = 'Qualified'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'LEAD' AND t."name" = 'Follow-up Required'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'LEAD' AND f."name" = 'Qualified'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'LEAD' AND t."name" = 'Lost'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'LEAD' AND f."name" = 'Qualified'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'LEAD' AND t."name" = 'Closed'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'LEAD' AND f."name" = 'Quotation Created'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'LEAD' AND t."name" = 'Quotation Accepted'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'LEAD' AND f."name" = 'Quotation Created'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'LEAD' AND t."name" = 'Follow-up Required'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'LEAD' AND f."name" = 'Quotation Created'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'LEAD' AND t."name" = 'Lost'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'LEAD' AND f."name" = 'Quotation Created'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'LEAD' AND t."name" = 'Closed'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'LEAD' AND f."name" = 'Quotation Accepted'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'LEAD' AND t."name" = 'Payment Pending'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'LEAD' AND f."name" = 'Quotation Accepted'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'LEAD' AND t."name" = 'Follow-up Required'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'LEAD' AND f."name" = 'Quotation Accepted'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'LEAD' AND t."name" = 'Lost'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'LEAD' AND f."name" = 'Quotation Accepted'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'LEAD' AND t."name" = 'Closed'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'LEAD' AND f."name" = 'Payment Pending'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'LEAD' AND t."name" = 'Converted'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'LEAD' AND f."name" = 'Payment Pending'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'LEAD' AND t."name" = 'Follow-up Required'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'LEAD' AND f."name" = 'Payment Pending'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'LEAD' AND t."name" = 'Lost'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'LEAD' AND f."name" = 'Payment Pending'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'LEAD' AND t."name" = 'Closed'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'LEAD' AND f."name" = 'New'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'LEAD' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'LEAD' AND f."name" = 'On Hold'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'LEAD' AND t."name" = 'New'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'LEAD' AND f."name" = 'Contacted'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'LEAD' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'LEAD' AND f."name" = 'On Hold'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'LEAD' AND t."name" = 'Contacted'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'LEAD' AND f."name" = 'Follow-up Required'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'LEAD' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'LEAD' AND f."name" = 'On Hold'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'LEAD' AND t."name" = 'Follow-up Required'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'LEAD' AND f."name" = 'Customer Responded'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'LEAD' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'LEAD' AND f."name" = 'On Hold'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'LEAD' AND t."name" = 'Customer Responded'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'LEAD' AND f."name" = 'Qualified'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'LEAD' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'LEAD' AND f."name" = 'On Hold'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'LEAD' AND t."name" = 'Qualified'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'LEAD' AND f."name" = 'Quotation Created'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'LEAD' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'LEAD' AND f."name" = 'On Hold'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'LEAD' AND t."name" = 'Quotation Created'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'LEAD' AND f."name" = 'Quotation Accepted'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'LEAD' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'LEAD' AND f."name" = 'On Hold'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'LEAD' AND t."name" = 'Quotation Accepted'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'LEAD' AND f."name" = 'Payment Pending'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'LEAD' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_EXTENSION' AND f."scope" = 'LEAD' AND f."name" = 'On Hold'
  AND t."serviceType" = 'VISA_EXTENSION' AND t."scope" = 'LEAD' AND t."name" = 'Payment Pending'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;

-- VISA_CHANGE / LEAD
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('VISA_CHANGE|LEAD|New'), 'VISA_CHANGE', 'LEAD', 'New', NULL, 0, false, false, NULL, 'NEW', NULL, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('VISA_CHANGE|LEAD|Contacted'), 'VISA_CHANGE', 'LEAD', 'Contacted', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'VISA_CHANGE' AND "scope" = 'LEAD' AND "name" = 'New') + 1, 10), false, false, NULL, 'CONTACTED', NULL, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('VISA_CHANGE|LEAD|Follow-up Required'), 'VISA_CHANGE', 'LEAD', 'Follow-up Required', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'VISA_CHANGE' AND "scope" = 'LEAD' AND "name" = 'Contacted') + 1, 20), false, false, NULL, 'FOLLOW_UP_REQUIRED', NULL, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('VISA_CHANGE|LEAD|Customer Responded'), 'VISA_CHANGE', 'LEAD', 'Customer Responded', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'VISA_CHANGE' AND "scope" = 'LEAD' AND "name" = 'Follow-up Required') + 1, 30), false, false, NULL, 'CUSTOMER_RESPONDED', NULL, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('VISA_CHANGE|LEAD|Qualified'), 'VISA_CHANGE', 'LEAD', 'Qualified', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'VISA_CHANGE' AND "scope" = 'LEAD' AND "name" = 'Customer Responded') + 1, 40), false, false, NULL, 'QUALIFIED', NULL, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('VISA_CHANGE|LEAD|Quotation Created'), 'VISA_CHANGE', 'LEAD', 'Quotation Created', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'VISA_CHANGE' AND "scope" = 'LEAD' AND "name" = 'Qualified') + 1, 50), false, false, NULL, 'QUOTATION_CREATED', NULL, 'QUOTATION_CREATED', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('VISA_CHANGE|LEAD|Quotation Accepted'), 'VISA_CHANGE', 'LEAD', 'Quotation Accepted', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'VISA_CHANGE' AND "scope" = 'LEAD' AND "name" = 'Quotation Created') + 1, 60), false, false, NULL, 'QUOTATION_ACCEPTED', NULL, 'QUOTATION_ACCEPTED', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('VISA_CHANGE|LEAD|Payment Pending'), 'VISA_CHANGE', 'LEAD', 'Payment Pending', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'VISA_CHANGE' AND "scope" = 'LEAD' AND "name" = 'Quotation Accepted') + 1, 70), false, false, NULL, 'PAYMENT_PENDING', NULL, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('VISA_CHANGE|LEAD|Converted'), 'VISA_CHANGE', 'LEAD', 'Converted', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'VISA_CHANGE' AND "scope" = 'LEAD' AND "name" = 'Payment Pending') + 1, 80), true, false, NULL, 'CONVERTED', NULL, 'PAYMENT_SUCCESS', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('VISA_CHANGE|LEAD|Lost'), 'VISA_CHANGE', 'LEAD', 'Lost', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'VISA_CHANGE' AND "scope" = 'LEAD' AND "name" = 'Converted') + 1, 90), true, false, NULL, 'LOST', NULL, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('VISA_CHANGE|LEAD|Closed'), 'VISA_CHANGE', 'LEAD', 'Closed', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'VISA_CHANGE' AND "scope" = 'LEAD' AND "name" = 'Lost') + 1, 100), true, false, NULL, 'CLOSED', NULL, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('VISA_CHANGE|LEAD|On Hold'), 'VISA_CHANGE', 'LEAD', 'On Hold', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'VISA_CHANGE' AND "scope" = 'LEAD' AND "name" = 'Closed') + 1, 110), false, false, NULL, NULL, NULL, 'ON_HOLD', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'LEAD' AND f."name" = 'New'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'LEAD' AND t."name" = 'Contacted'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'LEAD' AND f."name" = 'New'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'LEAD' AND t."name" = 'Follow-up Required'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'LEAD' AND f."name" = 'New'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'LEAD' AND t."name" = 'Lost'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'LEAD' AND f."name" = 'New'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'LEAD' AND t."name" = 'Closed'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'LEAD' AND f."name" = 'Contacted'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'LEAD' AND t."name" = 'Follow-up Required'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'LEAD' AND f."name" = 'Contacted'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'LEAD' AND t."name" = 'Customer Responded'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'LEAD' AND f."name" = 'Contacted'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'LEAD' AND t."name" = 'Qualified'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'LEAD' AND f."name" = 'Contacted'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'LEAD' AND t."name" = 'Lost'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'LEAD' AND f."name" = 'Contacted'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'LEAD' AND t."name" = 'Closed'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'LEAD' AND f."name" = 'Follow-up Required'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'LEAD' AND t."name" = 'Contacted'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'LEAD' AND f."name" = 'Follow-up Required'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'LEAD' AND t."name" = 'Customer Responded'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'LEAD' AND f."name" = 'Follow-up Required'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'LEAD' AND t."name" = 'Qualified'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'LEAD' AND f."name" = 'Follow-up Required'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'LEAD' AND t."name" = 'Lost'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'LEAD' AND f."name" = 'Follow-up Required'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'LEAD' AND t."name" = 'Closed'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'LEAD' AND f."name" = 'Customer Responded'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'LEAD' AND t."name" = 'Qualified'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'LEAD' AND f."name" = 'Customer Responded'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'LEAD' AND t."name" = 'Follow-up Required'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'LEAD' AND f."name" = 'Customer Responded'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'LEAD' AND t."name" = 'Lost'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'LEAD' AND f."name" = 'Customer Responded'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'LEAD' AND t."name" = 'Closed'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'LEAD' AND f."name" = 'Qualified'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'LEAD' AND t."name" = 'Quotation Created'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'LEAD' AND f."name" = 'Qualified'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'LEAD' AND t."name" = 'Follow-up Required'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'LEAD' AND f."name" = 'Qualified'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'LEAD' AND t."name" = 'Lost'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'LEAD' AND f."name" = 'Qualified'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'LEAD' AND t."name" = 'Closed'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'LEAD' AND f."name" = 'Quotation Created'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'LEAD' AND t."name" = 'Quotation Accepted'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'LEAD' AND f."name" = 'Quotation Created'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'LEAD' AND t."name" = 'Follow-up Required'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'LEAD' AND f."name" = 'Quotation Created'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'LEAD' AND t."name" = 'Lost'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'LEAD' AND f."name" = 'Quotation Created'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'LEAD' AND t."name" = 'Closed'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'LEAD' AND f."name" = 'Quotation Accepted'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'LEAD' AND t."name" = 'Payment Pending'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'LEAD' AND f."name" = 'Quotation Accepted'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'LEAD' AND t."name" = 'Follow-up Required'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'LEAD' AND f."name" = 'Quotation Accepted'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'LEAD' AND t."name" = 'Lost'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'LEAD' AND f."name" = 'Quotation Accepted'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'LEAD' AND t."name" = 'Closed'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'LEAD' AND f."name" = 'Payment Pending'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'LEAD' AND t."name" = 'Converted'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'LEAD' AND f."name" = 'Payment Pending'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'LEAD' AND t."name" = 'Follow-up Required'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'LEAD' AND f."name" = 'Payment Pending'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'LEAD' AND t."name" = 'Lost'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'LEAD' AND f."name" = 'Payment Pending'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'LEAD' AND t."name" = 'Closed'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'LEAD' AND f."name" = 'New'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'LEAD' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'LEAD' AND f."name" = 'On Hold'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'LEAD' AND t."name" = 'New'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'LEAD' AND f."name" = 'Contacted'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'LEAD' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'LEAD' AND f."name" = 'On Hold'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'LEAD' AND t."name" = 'Contacted'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'LEAD' AND f."name" = 'Follow-up Required'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'LEAD' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'LEAD' AND f."name" = 'On Hold'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'LEAD' AND t."name" = 'Follow-up Required'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'LEAD' AND f."name" = 'Customer Responded'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'LEAD' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'LEAD' AND f."name" = 'On Hold'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'LEAD' AND t."name" = 'Customer Responded'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'LEAD' AND f."name" = 'Qualified'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'LEAD' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'LEAD' AND f."name" = 'On Hold'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'LEAD' AND t."name" = 'Qualified'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'LEAD' AND f."name" = 'Quotation Created'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'LEAD' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'LEAD' AND f."name" = 'On Hold'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'LEAD' AND t."name" = 'Quotation Created'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'LEAD' AND f."name" = 'Quotation Accepted'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'LEAD' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'LEAD' AND f."name" = 'On Hold'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'LEAD' AND t."name" = 'Quotation Accepted'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'LEAD' AND f."name" = 'Payment Pending'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'LEAD' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'VISA_CHANGE' AND f."scope" = 'LEAD' AND f."name" = 'On Hold'
  AND t."serviceType" = 'VISA_CHANGE' AND t."scope" = 'LEAD' AND t."name" = 'Payment Pending'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;

-- RETURN_TICKET / LEAD
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('RETURN_TICKET|LEAD|New'), 'RETURN_TICKET', 'LEAD', 'New', NULL, 0, false, false, NULL, 'NEW', NULL, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('RETURN_TICKET|LEAD|Contacted'), 'RETURN_TICKET', 'LEAD', 'Contacted', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'RETURN_TICKET' AND "scope" = 'LEAD' AND "name" = 'New') + 1, 10), false, false, NULL, 'CONTACTED', NULL, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('RETURN_TICKET|LEAD|Follow-up Required'), 'RETURN_TICKET', 'LEAD', 'Follow-up Required', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'RETURN_TICKET' AND "scope" = 'LEAD' AND "name" = 'Contacted') + 1, 20), false, false, NULL, 'FOLLOW_UP_REQUIRED', NULL, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('RETURN_TICKET|LEAD|Customer Responded'), 'RETURN_TICKET', 'LEAD', 'Customer Responded', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'RETURN_TICKET' AND "scope" = 'LEAD' AND "name" = 'Follow-up Required') + 1, 30), false, false, NULL, 'CUSTOMER_RESPONDED', NULL, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('RETURN_TICKET|LEAD|Qualified'), 'RETURN_TICKET', 'LEAD', 'Qualified', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'RETURN_TICKET' AND "scope" = 'LEAD' AND "name" = 'Customer Responded') + 1, 40), false, false, NULL, 'QUALIFIED', NULL, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('RETURN_TICKET|LEAD|Quotation Created'), 'RETURN_TICKET', 'LEAD', 'Quotation Created', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'RETURN_TICKET' AND "scope" = 'LEAD' AND "name" = 'Qualified') + 1, 50), false, false, NULL, 'QUOTATION_CREATED', NULL, 'QUOTATION_CREATED', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('RETURN_TICKET|LEAD|Quotation Accepted'), 'RETURN_TICKET', 'LEAD', 'Quotation Accepted', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'RETURN_TICKET' AND "scope" = 'LEAD' AND "name" = 'Quotation Created') + 1, 60), false, false, NULL, 'QUOTATION_ACCEPTED', NULL, 'QUOTATION_ACCEPTED', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('RETURN_TICKET|LEAD|Payment Pending'), 'RETURN_TICKET', 'LEAD', 'Payment Pending', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'RETURN_TICKET' AND "scope" = 'LEAD' AND "name" = 'Quotation Accepted') + 1, 70), false, false, NULL, 'PAYMENT_PENDING', NULL, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('RETURN_TICKET|LEAD|Converted'), 'RETURN_TICKET', 'LEAD', 'Converted', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'RETURN_TICKET' AND "scope" = 'LEAD' AND "name" = 'Payment Pending') + 1, 80), true, false, NULL, 'CONVERTED', NULL, 'PAYMENT_SUCCESS', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('RETURN_TICKET|LEAD|Lost'), 'RETURN_TICKET', 'LEAD', 'Lost', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'RETURN_TICKET' AND "scope" = 'LEAD' AND "name" = 'Converted') + 1, 90), true, false, NULL, 'LOST', NULL, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('RETURN_TICKET|LEAD|Closed'), 'RETURN_TICKET', 'LEAD', 'Closed', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'RETURN_TICKET' AND "scope" = 'LEAD' AND "name" = 'Lost') + 1, 100), true, false, NULL, 'CLOSED', NULL, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('RETURN_TICKET|LEAD|On Hold'), 'RETURN_TICKET', 'LEAD', 'On Hold', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'RETURN_TICKET' AND "scope" = 'LEAD' AND "name" = 'Closed') + 1, 110), false, false, NULL, NULL, NULL, 'ON_HOLD', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'LEAD' AND f."name" = 'New'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'LEAD' AND t."name" = 'Contacted'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'LEAD' AND f."name" = 'New'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'LEAD' AND t."name" = 'Follow-up Required'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'LEAD' AND f."name" = 'New'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'LEAD' AND t."name" = 'Lost'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'LEAD' AND f."name" = 'New'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'LEAD' AND t."name" = 'Closed'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'LEAD' AND f."name" = 'Contacted'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'LEAD' AND t."name" = 'Follow-up Required'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'LEAD' AND f."name" = 'Contacted'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'LEAD' AND t."name" = 'Customer Responded'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'LEAD' AND f."name" = 'Contacted'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'LEAD' AND t."name" = 'Qualified'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'LEAD' AND f."name" = 'Contacted'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'LEAD' AND t."name" = 'Lost'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'LEAD' AND f."name" = 'Contacted'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'LEAD' AND t."name" = 'Closed'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'LEAD' AND f."name" = 'Follow-up Required'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'LEAD' AND t."name" = 'Contacted'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'LEAD' AND f."name" = 'Follow-up Required'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'LEAD' AND t."name" = 'Customer Responded'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'LEAD' AND f."name" = 'Follow-up Required'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'LEAD' AND t."name" = 'Qualified'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'LEAD' AND f."name" = 'Follow-up Required'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'LEAD' AND t."name" = 'Lost'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'LEAD' AND f."name" = 'Follow-up Required'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'LEAD' AND t."name" = 'Closed'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'LEAD' AND f."name" = 'Customer Responded'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'LEAD' AND t."name" = 'Qualified'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'LEAD' AND f."name" = 'Customer Responded'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'LEAD' AND t."name" = 'Follow-up Required'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'LEAD' AND f."name" = 'Customer Responded'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'LEAD' AND t."name" = 'Lost'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'LEAD' AND f."name" = 'Customer Responded'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'LEAD' AND t."name" = 'Closed'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'LEAD' AND f."name" = 'Qualified'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'LEAD' AND t."name" = 'Quotation Created'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'LEAD' AND f."name" = 'Qualified'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'LEAD' AND t."name" = 'Follow-up Required'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'LEAD' AND f."name" = 'Qualified'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'LEAD' AND t."name" = 'Lost'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'LEAD' AND f."name" = 'Qualified'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'LEAD' AND t."name" = 'Closed'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'LEAD' AND f."name" = 'Quotation Created'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'LEAD' AND t."name" = 'Quotation Accepted'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'LEAD' AND f."name" = 'Quotation Created'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'LEAD' AND t."name" = 'Follow-up Required'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'LEAD' AND f."name" = 'Quotation Created'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'LEAD' AND t."name" = 'Lost'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'LEAD' AND f."name" = 'Quotation Created'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'LEAD' AND t."name" = 'Closed'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'LEAD' AND f."name" = 'Quotation Accepted'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'LEAD' AND t."name" = 'Payment Pending'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'LEAD' AND f."name" = 'Quotation Accepted'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'LEAD' AND t."name" = 'Follow-up Required'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'LEAD' AND f."name" = 'Quotation Accepted'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'LEAD' AND t."name" = 'Lost'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'LEAD' AND f."name" = 'Quotation Accepted'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'LEAD' AND t."name" = 'Closed'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'LEAD' AND f."name" = 'Payment Pending'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'LEAD' AND t."name" = 'Converted'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'LEAD' AND f."name" = 'Payment Pending'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'LEAD' AND t."name" = 'Follow-up Required'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'LEAD' AND f."name" = 'Payment Pending'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'LEAD' AND t."name" = 'Lost'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'LEAD' AND f."name" = 'Payment Pending'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'LEAD' AND t."name" = 'Closed'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'LEAD' AND f."name" = 'New'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'LEAD' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'LEAD' AND f."name" = 'On Hold'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'LEAD' AND t."name" = 'New'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'LEAD' AND f."name" = 'Contacted'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'LEAD' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'LEAD' AND f."name" = 'On Hold'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'LEAD' AND t."name" = 'Contacted'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'LEAD' AND f."name" = 'Follow-up Required'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'LEAD' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'LEAD' AND f."name" = 'On Hold'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'LEAD' AND t."name" = 'Follow-up Required'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'LEAD' AND f."name" = 'Customer Responded'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'LEAD' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'LEAD' AND f."name" = 'On Hold'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'LEAD' AND t."name" = 'Customer Responded'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'LEAD' AND f."name" = 'Qualified'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'LEAD' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'LEAD' AND f."name" = 'On Hold'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'LEAD' AND t."name" = 'Qualified'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'LEAD' AND f."name" = 'Quotation Created'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'LEAD' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'LEAD' AND f."name" = 'On Hold'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'LEAD' AND t."name" = 'Quotation Created'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'LEAD' AND f."name" = 'Quotation Accepted'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'LEAD' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'LEAD' AND f."name" = 'On Hold'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'LEAD' AND t."name" = 'Quotation Accepted'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'LEAD' AND f."name" = 'Payment Pending'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'LEAD' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'RETURN_TICKET' AND f."scope" = 'LEAD' AND f."name" = 'On Hold'
  AND t."serviceType" = 'RETURN_TICKET' AND t."scope" = 'LEAD' AND t."name" = 'Payment Pending'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;

-- OTB / LEAD
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('OTB|LEAD|New'), 'OTB', 'LEAD', 'New', NULL, 0, false, false, NULL, 'NEW', NULL, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('OTB|LEAD|Contacted'), 'OTB', 'LEAD', 'Contacted', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'OTB' AND "scope" = 'LEAD' AND "name" = 'New') + 1, 10), false, false, NULL, 'CONTACTED', NULL, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('OTB|LEAD|Follow-up Required'), 'OTB', 'LEAD', 'Follow-up Required', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'OTB' AND "scope" = 'LEAD' AND "name" = 'Contacted') + 1, 20), false, false, NULL, 'FOLLOW_UP_REQUIRED', NULL, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('OTB|LEAD|Customer Responded'), 'OTB', 'LEAD', 'Customer Responded', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'OTB' AND "scope" = 'LEAD' AND "name" = 'Follow-up Required') + 1, 30), false, false, NULL, 'CUSTOMER_RESPONDED', NULL, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('OTB|LEAD|Qualified'), 'OTB', 'LEAD', 'Qualified', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'OTB' AND "scope" = 'LEAD' AND "name" = 'Customer Responded') + 1, 40), false, false, NULL, 'QUALIFIED', NULL, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('OTB|LEAD|Quotation Created'), 'OTB', 'LEAD', 'Quotation Created', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'OTB' AND "scope" = 'LEAD' AND "name" = 'Qualified') + 1, 50), false, false, NULL, 'QUOTATION_CREATED', NULL, 'QUOTATION_CREATED', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('OTB|LEAD|Quotation Accepted'), 'OTB', 'LEAD', 'Quotation Accepted', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'OTB' AND "scope" = 'LEAD' AND "name" = 'Quotation Created') + 1, 60), false, false, NULL, 'QUOTATION_ACCEPTED', NULL, 'QUOTATION_ACCEPTED', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('OTB|LEAD|Payment Pending'), 'OTB', 'LEAD', 'Payment Pending', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'OTB' AND "scope" = 'LEAD' AND "name" = 'Quotation Accepted') + 1, 70), false, false, NULL, 'PAYMENT_PENDING', NULL, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('OTB|LEAD|Converted'), 'OTB', 'LEAD', 'Converted', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'OTB' AND "scope" = 'LEAD' AND "name" = 'Payment Pending') + 1, 80), true, false, NULL, 'CONVERTED', NULL, 'PAYMENT_SUCCESS', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('OTB|LEAD|Lost'), 'OTB', 'LEAD', 'Lost', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'OTB' AND "scope" = 'LEAD' AND "name" = 'Converted') + 1, 90), true, false, NULL, 'LOST', NULL, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('OTB|LEAD|Closed'), 'OTB', 'LEAD', 'Closed', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'OTB' AND "scope" = 'LEAD' AND "name" = 'Lost') + 1, 100), true, false, NULL, 'CLOSED', NULL, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('OTB|LEAD|On Hold'), 'OTB', 'LEAD', 'On Hold', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'OTB' AND "scope" = 'LEAD' AND "name" = 'Closed') + 1, 110), false, false, NULL, NULL, NULL, 'ON_HOLD', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'LEAD' AND f."name" = 'New'
  AND t."serviceType" = 'OTB' AND t."scope" = 'LEAD' AND t."name" = 'Contacted'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'LEAD' AND f."name" = 'New'
  AND t."serviceType" = 'OTB' AND t."scope" = 'LEAD' AND t."name" = 'Follow-up Required'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'LEAD' AND f."name" = 'New'
  AND t."serviceType" = 'OTB' AND t."scope" = 'LEAD' AND t."name" = 'Lost'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'LEAD' AND f."name" = 'New'
  AND t."serviceType" = 'OTB' AND t."scope" = 'LEAD' AND t."name" = 'Closed'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'LEAD' AND f."name" = 'Contacted'
  AND t."serviceType" = 'OTB' AND t."scope" = 'LEAD' AND t."name" = 'Follow-up Required'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'LEAD' AND f."name" = 'Contacted'
  AND t."serviceType" = 'OTB' AND t."scope" = 'LEAD' AND t."name" = 'Customer Responded'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'LEAD' AND f."name" = 'Contacted'
  AND t."serviceType" = 'OTB' AND t."scope" = 'LEAD' AND t."name" = 'Qualified'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'LEAD' AND f."name" = 'Contacted'
  AND t."serviceType" = 'OTB' AND t."scope" = 'LEAD' AND t."name" = 'Lost'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'LEAD' AND f."name" = 'Contacted'
  AND t."serviceType" = 'OTB' AND t."scope" = 'LEAD' AND t."name" = 'Closed'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'LEAD' AND f."name" = 'Follow-up Required'
  AND t."serviceType" = 'OTB' AND t."scope" = 'LEAD' AND t."name" = 'Contacted'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'LEAD' AND f."name" = 'Follow-up Required'
  AND t."serviceType" = 'OTB' AND t."scope" = 'LEAD' AND t."name" = 'Customer Responded'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'LEAD' AND f."name" = 'Follow-up Required'
  AND t."serviceType" = 'OTB' AND t."scope" = 'LEAD' AND t."name" = 'Qualified'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'LEAD' AND f."name" = 'Follow-up Required'
  AND t."serviceType" = 'OTB' AND t."scope" = 'LEAD' AND t."name" = 'Lost'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'LEAD' AND f."name" = 'Follow-up Required'
  AND t."serviceType" = 'OTB' AND t."scope" = 'LEAD' AND t."name" = 'Closed'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'LEAD' AND f."name" = 'Customer Responded'
  AND t."serviceType" = 'OTB' AND t."scope" = 'LEAD' AND t."name" = 'Qualified'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'LEAD' AND f."name" = 'Customer Responded'
  AND t."serviceType" = 'OTB' AND t."scope" = 'LEAD' AND t."name" = 'Follow-up Required'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'LEAD' AND f."name" = 'Customer Responded'
  AND t."serviceType" = 'OTB' AND t."scope" = 'LEAD' AND t."name" = 'Lost'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'LEAD' AND f."name" = 'Customer Responded'
  AND t."serviceType" = 'OTB' AND t."scope" = 'LEAD' AND t."name" = 'Closed'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'LEAD' AND f."name" = 'Qualified'
  AND t."serviceType" = 'OTB' AND t."scope" = 'LEAD' AND t."name" = 'Quotation Created'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'LEAD' AND f."name" = 'Qualified'
  AND t."serviceType" = 'OTB' AND t."scope" = 'LEAD' AND t."name" = 'Follow-up Required'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'LEAD' AND f."name" = 'Qualified'
  AND t."serviceType" = 'OTB' AND t."scope" = 'LEAD' AND t."name" = 'Lost'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'LEAD' AND f."name" = 'Qualified'
  AND t."serviceType" = 'OTB' AND t."scope" = 'LEAD' AND t."name" = 'Closed'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'LEAD' AND f."name" = 'Quotation Created'
  AND t."serviceType" = 'OTB' AND t."scope" = 'LEAD' AND t."name" = 'Quotation Accepted'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'LEAD' AND f."name" = 'Quotation Created'
  AND t."serviceType" = 'OTB' AND t."scope" = 'LEAD' AND t."name" = 'Follow-up Required'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'LEAD' AND f."name" = 'Quotation Created'
  AND t."serviceType" = 'OTB' AND t."scope" = 'LEAD' AND t."name" = 'Lost'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'LEAD' AND f."name" = 'Quotation Created'
  AND t."serviceType" = 'OTB' AND t."scope" = 'LEAD' AND t."name" = 'Closed'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'LEAD' AND f."name" = 'Quotation Accepted'
  AND t."serviceType" = 'OTB' AND t."scope" = 'LEAD' AND t."name" = 'Payment Pending'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'LEAD' AND f."name" = 'Quotation Accepted'
  AND t."serviceType" = 'OTB' AND t."scope" = 'LEAD' AND t."name" = 'Follow-up Required'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'LEAD' AND f."name" = 'Quotation Accepted'
  AND t."serviceType" = 'OTB' AND t."scope" = 'LEAD' AND t."name" = 'Lost'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'LEAD' AND f."name" = 'Quotation Accepted'
  AND t."serviceType" = 'OTB' AND t."scope" = 'LEAD' AND t."name" = 'Closed'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'LEAD' AND f."name" = 'Payment Pending'
  AND t."serviceType" = 'OTB' AND t."scope" = 'LEAD' AND t."name" = 'Converted'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'LEAD' AND f."name" = 'Payment Pending'
  AND t."serviceType" = 'OTB' AND t."scope" = 'LEAD' AND t."name" = 'Follow-up Required'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'LEAD' AND f."name" = 'Payment Pending'
  AND t."serviceType" = 'OTB' AND t."scope" = 'LEAD' AND t."name" = 'Lost'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'LEAD' AND f."name" = 'Payment Pending'
  AND t."serviceType" = 'OTB' AND t."scope" = 'LEAD' AND t."name" = 'Closed'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'LEAD' AND f."name" = 'New'
  AND t."serviceType" = 'OTB' AND t."scope" = 'LEAD' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'LEAD' AND f."name" = 'On Hold'
  AND t."serviceType" = 'OTB' AND t."scope" = 'LEAD' AND t."name" = 'New'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'LEAD' AND f."name" = 'Contacted'
  AND t."serviceType" = 'OTB' AND t."scope" = 'LEAD' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'LEAD' AND f."name" = 'On Hold'
  AND t."serviceType" = 'OTB' AND t."scope" = 'LEAD' AND t."name" = 'Contacted'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'LEAD' AND f."name" = 'Follow-up Required'
  AND t."serviceType" = 'OTB' AND t."scope" = 'LEAD' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'LEAD' AND f."name" = 'On Hold'
  AND t."serviceType" = 'OTB' AND t."scope" = 'LEAD' AND t."name" = 'Follow-up Required'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'LEAD' AND f."name" = 'Customer Responded'
  AND t."serviceType" = 'OTB' AND t."scope" = 'LEAD' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'LEAD' AND f."name" = 'On Hold'
  AND t."serviceType" = 'OTB' AND t."scope" = 'LEAD' AND t."name" = 'Customer Responded'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'LEAD' AND f."name" = 'Qualified'
  AND t."serviceType" = 'OTB' AND t."scope" = 'LEAD' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'LEAD' AND f."name" = 'On Hold'
  AND t."serviceType" = 'OTB' AND t."scope" = 'LEAD' AND t."name" = 'Qualified'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'LEAD' AND f."name" = 'Quotation Created'
  AND t."serviceType" = 'OTB' AND t."scope" = 'LEAD' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'LEAD' AND f."name" = 'On Hold'
  AND t."serviceType" = 'OTB' AND t."scope" = 'LEAD' AND t."name" = 'Quotation Created'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'LEAD' AND f."name" = 'Quotation Accepted'
  AND t."serviceType" = 'OTB' AND t."scope" = 'LEAD' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'LEAD' AND f."name" = 'On Hold'
  AND t."serviceType" = 'OTB' AND t."scope" = 'LEAD' AND t."name" = 'Quotation Accepted'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'LEAD' AND f."name" = 'Payment Pending'
  AND t."serviceType" = 'OTB' AND t."scope" = 'LEAD' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'OTB' AND f."scope" = 'LEAD' AND f."name" = 'On Hold'
  AND t."serviceType" = 'OTB' AND t."scope" = 'LEAD' AND t."name" = 'Payment Pending'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;

-- FLIGHT_SPECIAL_FARE / LEAD
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('FLIGHT_SPECIAL_FARE|LEAD|New'), 'FLIGHT_SPECIAL_FARE', 'LEAD', 'New', NULL, 0, false, false, NULL, 'NEW', NULL, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('FLIGHT_SPECIAL_FARE|LEAD|Contacted'), 'FLIGHT_SPECIAL_FARE', 'LEAD', 'Contacted', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'FLIGHT_SPECIAL_FARE' AND "scope" = 'LEAD' AND "name" = 'New') + 1, 10), false, false, NULL, 'CONTACTED', NULL, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('FLIGHT_SPECIAL_FARE|LEAD|Follow-up Required'), 'FLIGHT_SPECIAL_FARE', 'LEAD', 'Follow-up Required', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'FLIGHT_SPECIAL_FARE' AND "scope" = 'LEAD' AND "name" = 'Contacted') + 1, 20), false, false, NULL, 'FOLLOW_UP_REQUIRED', NULL, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('FLIGHT_SPECIAL_FARE|LEAD|Customer Responded'), 'FLIGHT_SPECIAL_FARE', 'LEAD', 'Customer Responded', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'FLIGHT_SPECIAL_FARE' AND "scope" = 'LEAD' AND "name" = 'Follow-up Required') + 1, 30), false, false, NULL, 'CUSTOMER_RESPONDED', NULL, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('FLIGHT_SPECIAL_FARE|LEAD|Qualified'), 'FLIGHT_SPECIAL_FARE', 'LEAD', 'Qualified', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'FLIGHT_SPECIAL_FARE' AND "scope" = 'LEAD' AND "name" = 'Customer Responded') + 1, 40), false, false, NULL, 'QUALIFIED', NULL, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('FLIGHT_SPECIAL_FARE|LEAD|Quotation Created'), 'FLIGHT_SPECIAL_FARE', 'LEAD', 'Quotation Created', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'FLIGHT_SPECIAL_FARE' AND "scope" = 'LEAD' AND "name" = 'Qualified') + 1, 50), false, false, NULL, 'QUOTATION_CREATED', NULL, 'QUOTATION_CREATED', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('FLIGHT_SPECIAL_FARE|LEAD|Quotation Accepted'), 'FLIGHT_SPECIAL_FARE', 'LEAD', 'Quotation Accepted', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'FLIGHT_SPECIAL_FARE' AND "scope" = 'LEAD' AND "name" = 'Quotation Created') + 1, 60), false, false, NULL, 'QUOTATION_ACCEPTED', NULL, 'QUOTATION_ACCEPTED', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('FLIGHT_SPECIAL_FARE|LEAD|Payment Pending'), 'FLIGHT_SPECIAL_FARE', 'LEAD', 'Payment Pending', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'FLIGHT_SPECIAL_FARE' AND "scope" = 'LEAD' AND "name" = 'Quotation Accepted') + 1, 70), false, false, NULL, 'PAYMENT_PENDING', NULL, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('FLIGHT_SPECIAL_FARE|LEAD|Converted'), 'FLIGHT_SPECIAL_FARE', 'LEAD', 'Converted', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'FLIGHT_SPECIAL_FARE' AND "scope" = 'LEAD' AND "name" = 'Payment Pending') + 1, 80), true, false, NULL, 'CONVERTED', NULL, 'PAYMENT_SUCCESS', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('FLIGHT_SPECIAL_FARE|LEAD|Lost'), 'FLIGHT_SPECIAL_FARE', 'LEAD', 'Lost', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'FLIGHT_SPECIAL_FARE' AND "scope" = 'LEAD' AND "name" = 'Converted') + 1, 90), true, false, NULL, 'LOST', NULL, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('FLIGHT_SPECIAL_FARE|LEAD|Closed'), 'FLIGHT_SPECIAL_FARE', 'LEAD', 'Closed', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'FLIGHT_SPECIAL_FARE' AND "scope" = 'LEAD' AND "name" = 'Lost') + 1, 100), true, false, NULL, 'CLOSED', NULL, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatus" ("id", "serviceType", "scope", "name", "group", "displayOrder", "isTerminal", "blocksRefund", "customerLabel", "mapsToLeadStatus", "mapsToBookingStatus", "systemEvent", "active", "createdAt", "updatedAt")
VALUES ('ss_' || md5('FLIGHT_SPECIAL_FARE|LEAD|On Hold'), 'FLIGHT_SPECIAL_FARE', 'LEAD', 'On Hold', NULL, COALESCE((SELECT "displayOrder" FROM "ServiceStatus" WHERE "serviceType" = 'FLIGHT_SPECIAL_FARE' AND "scope" = 'LEAD' AND "name" = 'Closed') + 1, 110), false, false, NULL, NULL, NULL, 'ON_HOLD', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("serviceType", "scope", "name") DO UPDATE SET
  "customerLabel" = COALESCE("ServiceStatus"."customerLabel", EXCLUDED."customerLabel"),
  "systemEvent" = COALESCE("ServiceStatus"."systemEvent", EXCLUDED."systemEvent");
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'LEAD' AND f."name" = 'New'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'LEAD' AND t."name" = 'Contacted'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'LEAD' AND f."name" = 'New'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'LEAD' AND t."name" = 'Follow-up Required'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'LEAD' AND f."name" = 'New'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'LEAD' AND t."name" = 'Lost'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'LEAD' AND f."name" = 'New'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'LEAD' AND t."name" = 'Closed'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'LEAD' AND f."name" = 'Contacted'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'LEAD' AND t."name" = 'Follow-up Required'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'LEAD' AND f."name" = 'Contacted'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'LEAD' AND t."name" = 'Customer Responded'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'LEAD' AND f."name" = 'Contacted'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'LEAD' AND t."name" = 'Qualified'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'LEAD' AND f."name" = 'Contacted'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'LEAD' AND t."name" = 'Lost'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'LEAD' AND f."name" = 'Contacted'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'LEAD' AND t."name" = 'Closed'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'LEAD' AND f."name" = 'Follow-up Required'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'LEAD' AND t."name" = 'Contacted'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'LEAD' AND f."name" = 'Follow-up Required'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'LEAD' AND t."name" = 'Customer Responded'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'LEAD' AND f."name" = 'Follow-up Required'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'LEAD' AND t."name" = 'Qualified'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'LEAD' AND f."name" = 'Follow-up Required'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'LEAD' AND t."name" = 'Lost'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'LEAD' AND f."name" = 'Follow-up Required'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'LEAD' AND t."name" = 'Closed'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'LEAD' AND f."name" = 'Customer Responded'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'LEAD' AND t."name" = 'Qualified'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'LEAD' AND f."name" = 'Customer Responded'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'LEAD' AND t."name" = 'Follow-up Required'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'LEAD' AND f."name" = 'Customer Responded'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'LEAD' AND t."name" = 'Lost'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'LEAD' AND f."name" = 'Customer Responded'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'LEAD' AND t."name" = 'Closed'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'LEAD' AND f."name" = 'Qualified'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'LEAD' AND t."name" = 'Quotation Created'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'LEAD' AND f."name" = 'Qualified'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'LEAD' AND t."name" = 'Follow-up Required'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'LEAD' AND f."name" = 'Qualified'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'LEAD' AND t."name" = 'Lost'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'LEAD' AND f."name" = 'Qualified'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'LEAD' AND t."name" = 'Closed'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'LEAD' AND f."name" = 'Quotation Created'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'LEAD' AND t."name" = 'Quotation Accepted'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'LEAD' AND f."name" = 'Quotation Created'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'LEAD' AND t."name" = 'Follow-up Required'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'LEAD' AND f."name" = 'Quotation Created'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'LEAD' AND t."name" = 'Lost'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'LEAD' AND f."name" = 'Quotation Created'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'LEAD' AND t."name" = 'Closed'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'LEAD' AND f."name" = 'Quotation Accepted'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'LEAD' AND t."name" = 'Payment Pending'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'LEAD' AND f."name" = 'Quotation Accepted'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'LEAD' AND t."name" = 'Follow-up Required'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'LEAD' AND f."name" = 'Quotation Accepted'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'LEAD' AND t."name" = 'Lost'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'LEAD' AND f."name" = 'Quotation Accepted'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'LEAD' AND t."name" = 'Closed'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'LEAD' AND f."name" = 'Payment Pending'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'LEAD' AND t."name" = 'Converted'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'LEAD' AND f."name" = 'Payment Pending'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'LEAD' AND t."name" = 'Follow-up Required'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'LEAD' AND f."name" = 'Payment Pending'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'LEAD' AND t."name" = 'Lost'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'LEAD' AND f."name" = 'Payment Pending'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'LEAD' AND t."name" = 'Closed'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'LEAD' AND f."name" = 'New'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'LEAD' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'LEAD' AND f."name" = 'On Hold'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'LEAD' AND t."name" = 'New'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'LEAD' AND f."name" = 'Contacted'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'LEAD' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'LEAD' AND f."name" = 'On Hold'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'LEAD' AND t."name" = 'Contacted'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'LEAD' AND f."name" = 'Follow-up Required'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'LEAD' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'LEAD' AND f."name" = 'On Hold'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'LEAD' AND t."name" = 'Follow-up Required'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'LEAD' AND f."name" = 'Customer Responded'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'LEAD' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'LEAD' AND f."name" = 'On Hold'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'LEAD' AND t."name" = 'Customer Responded'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'LEAD' AND f."name" = 'Qualified'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'LEAD' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'LEAD' AND f."name" = 'On Hold'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'LEAD' AND t."name" = 'Qualified'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'LEAD' AND f."name" = 'Quotation Created'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'LEAD' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'LEAD' AND f."name" = 'On Hold'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'LEAD' AND t."name" = 'Quotation Created'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'LEAD' AND f."name" = 'Quotation Accepted'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'LEAD' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'LEAD' AND f."name" = 'On Hold'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'LEAD' AND t."name" = 'Quotation Accepted'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'LEAD' AND f."name" = 'Payment Pending'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'LEAD' AND t."name" = 'On Hold'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;
INSERT INTO "ServiceStatusTransition" ("id", "fromStatusId", "toStatusId")
SELECT 'sst_' || md5(f."id" || '>' || t."id"), f."id", t."id" FROM "ServiceStatus" f, "ServiceStatus" t
WHERE f."serviceType" = 'FLIGHT_SPECIAL_FARE' AND f."scope" = 'LEAD' AND f."name" = 'On Hold'
  AND t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."scope" = 'LEAD' AND t."name" = 'Payment Pending'
ON CONFLICT ("fromStatusId", "toStatusId") DO NOTHING;

-- Backfill: every existing Lead/Booking gets the first active status of its
-- service whose mapsTo* matches its current coarse status. Rows with no
-- match (e.g. OTHER service, or a coarse value no status maps to) stay NULL.
UPDATE "Lead" l SET "serviceStatusId" = s."id"
FROM (
  SELECT DISTINCT ON ("serviceType", "mapsToLeadStatus") "id", "serviceType", "mapsToLeadStatus"
  FROM "ServiceStatus"
  WHERE "scope" = 'LEAD' AND "active" AND "mapsToLeadStatus" IS NOT NULL
  ORDER BY "serviceType", "mapsToLeadStatus", "displayOrder", "name"
) s
WHERE l."serviceStatusId" IS NULL AND s."serviceType" = l."serviceType" AND s."mapsToLeadStatus" = l."status";

UPDATE "Booking" b SET "serviceStatusId" = s."id"
FROM "Lead" l, (
  SELECT DISTINCT ON ("serviceType", "mapsToBookingStatus") "id", "serviceType", "mapsToBookingStatus"
  FROM "ServiceStatus"
  WHERE "scope" = 'BOOKING' AND "active" AND "mapsToBookingStatus" IS NOT NULL
  ORDER BY "serviceType", "mapsToBookingStatus", "displayOrder", "name"
) s
WHERE b."serviceStatusId" IS NULL AND l."id" = b."leadId" AND s."serviceType" = l."serviceType" AND s."mapsToBookingStatus" = b."status";
