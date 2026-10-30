-- wipe-transactional-data.sql — one-off: clear every customer record before the client starts fresh testing
-- (client request 2026-10-30: "delete from db: customer, bookings, leads, quotations, task and follow ups").
--
-- REMOVES (all rows): customers (+ OTPs, password-reset tokens), passengers, leads, quotations, bookings,
-- booking passengers, payments (= their invoices), refunds, protection plans, gateway attempts + webhook events,
-- documents + their stored files (FileBlob) + OCR extractions, tasks, enquiries & complaints, WhatsApp chats,
-- lead-scoped coupons, automation reminder logs (follow-up history) and staff notifications about those records.
-- Resets the invoice series (next invoice = TNS/A02601) and the enquiry serial (next = ENQ-TNA0001).
--
-- KEEPS: staff, roles, permissions, masters, rates/pricing, vendors, services, statuses + transitions, templates,
-- FAQs, website/legal pages, blog, all config, staff coupons, expenses, lead reference counters, and the AuditTrail
-- (history is never deleted).
--
-- USAGE (inside the Postgres container; ALWAYS pg_dump first):
--   psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -f wipe-transactional-data.sql
--       DRY RUN: deletes inside a transaction, prints the counts, then ROLLBACK — nothing changes.
--   psql ... -v confirm=WIPE -f wipe-transactional-data.sql
--       Same, then COMMIT.

\set ON_ERROR_STOP 1
BEGIN;

CREATE TEMP TABLE wipe_counts (step int, item text, rows bigint) ON COMMIT DROP;

-- Notifications / reminder logs that point at a record about to go.
WITH ids AS (
  SELECT id FROM "Customer" UNION ALL SELECT id FROM "Lead" UNION ALL SELECT id FROM "Quotation"
  UNION ALL SELECT id FROM "Booking" UNION ALL SELECT id FROM "Payment" UNION ALL SELECT id FROM "Refund"
  UNION ALL SELECT id FROM "Document" UNION ALL SELECT id FROM "Task" UNION ALL SELECT id FROM "Enquiry"
  UNION ALL SELECT id FROM "Passenger"
), d AS (DELETE FROM "StaffNotification" WHERE "entityId" IN (SELECT id FROM ids) RETURNING 1)
INSERT INTO wipe_counts SELECT 1, 'StaffNotification', count(*) FROM d;
WITH d AS (DELETE FROM "AutomationReminderLog" RETURNING 1) INSERT INTO wipe_counts SELECT 2, 'AutomationReminderLog', count(*) FROM d;

-- Stored files of documents and bank slips (FILE_STORAGE=db keeps them as FileBlob rows).
WITH urls AS (
  SELECT "fileUrl" AS url FROM "Document" WHERE "fileUrl" LIKE '/api/files/%'
  UNION SELECT "bankSlipUrl" FROM "Payment" WHERE "bankSlipUrl" LIKE '/api/files/%'
), d AS (DELETE FROM "FileBlob" WHERE id IN (SELECT substr(url, length('/api/files/') + 1) FROM urls) RETURNING 1)
INSERT INTO wipe_counts SELECT 3, 'FileBlob', count(*) FROM d;

WITH d AS (DELETE FROM "PaymentGatewayAttempt" RETURNING 1) INSERT INTO wipe_counts SELECT 4, 'PaymentGatewayAttempt', count(*) FROM d;
WITH d AS (DELETE FROM "PaymentWebhookEvent" RETURNING 1) INSERT INTO wipe_counts SELECT 5, 'PaymentWebhookEvent', count(*) FROM d;
WITH d AS (DELETE FROM "ProtectionPlan" RETURNING 1) INSERT INTO wipe_counts SELECT 6, 'ProtectionPlan', count(*) FROM d;
WITH d AS (DELETE FROM "Refund" RETURNING 1) INSERT INTO wipe_counts SELECT 7, 'Refund', count(*) FROM d;
WITH d AS (DELETE FROM "Payment" RETURNING 1) INSERT INTO wipe_counts SELECT 8, 'Payment (invoices)', count(*) FROM d;
WITH d AS (DELETE FROM "BookingPassenger" RETURNING 1) INSERT INTO wipe_counts SELECT 9, 'BookingPassenger', count(*) FROM d;
WITH d AS (DELETE FROM "Task" RETURNING 1) INSERT INTO wipe_counts SELECT 10, 'Task', count(*) FROM d;
WITH d AS (DELETE FROM "DocumentExtraction" RETURNING 1) INSERT INTO wipe_counts SELECT 11, 'DocumentExtraction', count(*) FROM d;
WITH d AS (DELETE FROM "Document" RETURNING 1) INSERT INTO wipe_counts SELECT 12, 'Document', count(*) FROM d;
UPDATE "Booking" SET "linkedBookingId" = NULL, "originalBookingId" = NULL;
WITH d AS (DELETE FROM "Booking" RETURNING 1) INSERT INTO wipe_counts SELECT 13, 'Booking', count(*) FROM d;
UPDATE "Quotation" SET "alternativeOfId" = NULL;
WITH d AS (DELETE FROM "Quotation" RETURNING 1) INSERT INTO wipe_counts SELECT 14, 'Quotation', count(*) FROM d;
WITH d AS (DELETE FROM "Enquiry" RETURNING 1) INSERT INTO wipe_counts SELECT 15, 'Enquiry', count(*) FROM d;
WITH d AS (DELETE FROM "WhatsAppConversation" RETURNING 1) INSERT INTO wipe_counts SELECT 16, 'WhatsAppConversation', count(*) FROM d;
WITH d AS (DELETE FROM "WhatsAppMessageLog" RETURNING 1) INSERT INTO wipe_counts SELECT 17, 'WhatsAppMessageLog', count(*) FROM d;
WITH d AS (DELETE FROM "Coupon" WHERE "leadId" IS NOT NULL RETURNING 1) INSERT INTO wipe_counts SELECT 18, 'Coupon (lead-scoped)', count(*) FROM d;
WITH d AS (DELETE FROM "Lead" RETURNING 1) INSERT INTO wipe_counts SELECT 19, 'Lead', count(*) FROM d;
WITH d AS (DELETE FROM "Passenger" RETURNING 1) INSERT INTO wipe_counts SELECT 20, 'Passenger', count(*) FROM d;
WITH d AS (DELETE FROM "CustomerOtp" RETURNING 1) INSERT INTO wipe_counts SELECT 21, 'CustomerOtp', count(*) FROM d;
WITH d AS (DELETE FROM "CustomerPasswordResetToken" RETURNING 1) INSERT INTO wipe_counts SELECT 22, 'CustomerPasswordResetToken', count(*) FROM d;
WITH d AS (DELETE FROM "Customer" RETURNING 1) INSERT INTO wipe_counts SELECT 23, 'Customer', count(*) FROM d;

-- Counters: no invoice or enquiry is left, so the series restart without any chance of a duplicate.
WITH d AS (DELETE FROM "InvoiceCounter" WHERE "financialYear" LIKE 'TNSA0-%' RETURNING 1) INSERT INTO wipe_counts SELECT 24, 'InvoiceCounter reset (next TNS/A02601)', count(*) FROM d;
WITH d AS (DELETE FROM "ReferenceCounter" WHERE "period" = 'ENQUIRY' RETURNING 1) INSERT INTO wipe_counts SELECT 25, 'Enquiry counter reset (next ENQ-TNA0001)', count(*) FROM d;

INSERT INTO "AuditTrail" ("id", "entityType", "entityId", "action", "note", "timestamp")
VALUES ('wipe_' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISS'), 'System', 'transactional-data', 'DATA_WIPE',
        'Customer records cleared before fresh testing (client request 2026-10-30; pre-wipe pg_dump taken)', CURRENT_TIMESTAMP);

SELECT item, rows FROM wipe_counts ORDER BY step;

SELECT false AS do_commit \gset
\if :{?confirm}
  SELECT (:'confirm' = 'WIPE') AS do_commit \gset
\endif
\if :do_commit
  COMMIT;
  \echo 'COMMITTED — data wiped.'
\else
  ROLLBACK;
  \echo 'DRY RUN — rolled back, nothing changed. Re-run with -v confirm=WIPE to commit.'
\endif
