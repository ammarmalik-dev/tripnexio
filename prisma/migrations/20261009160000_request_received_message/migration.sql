-- Client testing 2026-10-09 (B9/B19/B24, C8) — the "Request received" WhatsApp
-- and email carry the same per-service text as the website success screen,
-- via the new {{requestMessage}} variable (filled in by the lead pipeline).
-- The client asked for this wording on both channels, so the bodies are replaced.
UPDATE "NotificationTemplate"
SET "body" = E'Hi {{customerName}},\n\n{{requestMessage}}\n\nYour reference: {{leadReference}}',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "event" = 'LEAD_RECEIVED' AND "channel" = 'EMAIL';

UPDATE "NotificationTemplate"
SET "body" = E'Hi {{customerName}}, {{requestMessage}} Your reference: {{leadReference}}.',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "event" = 'LEAD_RECEIVED' AND "channel" = 'WHATSAPP';
