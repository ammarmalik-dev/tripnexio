-- Client 2026-10-28 ("remove old template and add new template") — retire the legacy notification templates that
-- no code path sends any more (every service now runs on the client's per-status templates). Data only: the rows
-- are kept and only switched off, so Admin → Notification Templates can still show them under
-- "Show retired templates" and an Admin can re-enable one. The list is RETIRED_NOTIFICATION_EVENTS in
-- src/lib/notifications/template-groups.ts (reasons there); every other legacy event is still sent and stays active.
UPDATE "NotificationTemplate"
SET "active" = false, "updatedAt" = now()
WHERE "event" IN ('DOCUMENT_REJECTED', 'OTB_APPROVED', 'SERVICE_STATUS_UPDATE', 'SAMPLE_LEAD_CREATED', 'SAMPLE_PAYMENT_SUCCESS')
  AND "active" = true;
