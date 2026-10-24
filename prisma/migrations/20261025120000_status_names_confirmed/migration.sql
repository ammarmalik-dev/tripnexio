-- Client "Final Developer Confirmations" 2026-10-25 — status names:
--   Visa / Visa Change / Visa Extension: "Applied to Embassy" for customer and CRM (never "Visa Application Submitted").
--   Hold: CRM "On Hold", customer "Booking On Hold" (every service).
-- Data only; no schema change. Admin-edited labels are left alone (only the seeded wording is replaced).

UPDATE "ServiceStatus" SET "customerLabel" = 'Applied to Embassy', "updatedAt" = now()
WHERE "serviceType" IN ('NEW_VISA', 'VISA_CHANGE', 'VISA_EXTENSION') AND "name" = 'Applied to Embassy'
  AND ("customerLabel" IS NULL OR "customerLabel" IN ('Visa Application Submitted', 'Application Submitted'));

-- New Visa / Special Fare named their hold status "Booking On Hold" in the CRM too: it becomes "On Hold".
-- An old inactive "On Hold" row (if any) is parked under another name first (the name is unique per service + scope).
UPDATE "ServiceStatus" s SET "name" = 'On Hold (old)', "updatedAt" = now()
WHERE s."name" = 'On Hold' AND s."active" = false
  AND EXISTS (SELECT 1 FROM "ServiceStatus" o WHERE o."serviceType" = s."serviceType" AND o."scope" = s."scope" AND o."name" = 'Booking On Hold')
  AND NOT EXISTS (SELECT 1 FROM "ServiceStatus" o WHERE o."serviceType" = s."serviceType" AND o."scope" = s."scope" AND o."name" = 'On Hold (old)');

UPDATE "ServiceStatus" s SET "name" = 'On Hold', "updatedAt" = now()
WHERE s."name" = 'Booking On Hold'
  AND NOT EXISTS (SELECT 1 FROM "ServiceStatus" o WHERE o."serviceType" = s."serviceType" AND o."scope" = s."scope" AND o."name" = 'On Hold');

UPDATE "ServiceStatus" SET "customerLabel" = 'Booking On Hold', "updatedAt" = now()
WHERE "systemEvent" = 'ON_HOLD' AND ("customerLabel" IS NULL OR "customerLabel" IN ('On Hold', 'Application On Hold'));

-- The "Applied to Embassy" email subject / heading said "application submitted".
UPDATE "NotificationTemplate" SET "subject" = 'Applied to Embassy — {{booking_id}}', "updatedAt" = now()
WHERE "channel" = 'EMAIL' AND "event" IN ('NV_APPLIED_TO_EMBASSY', 'VC_APPLIED_TO_EMBASSY', 'EXT_09')
  AND "subject" ILIKE '%application%submitted%';

UPDATE "NotificationTemplate" SET "heading" = 'Applied to Embassy', "updatedAt" = now()
WHERE "channel" = 'EMAIL' AND "event" IN ('NV_APPLIED_TO_EMBASSY', 'VC_APPLIED_TO_EMBASSY', 'EXT_09')
  AND ("heading" IS NULL OR "heading" ILIKE '%application%submitted%');
