-- Client 2026-10-14:
--   * "Replace payment links with a clear Pay Now / Download button across all services":
--     links are sent as buttons, so the WhatsApp bodies no longer print the URL.
--   * "Include passenger count, departure and arrival cities, and travel date in
--     confirmation WhatsApp and emails": new {{tripSummary}} variable.
--   * "Do not set a time limit on OTB, Return Ticket and New Visa payment links":
--     the payment-link message no longer states a validity.
-- Each UPDATE only touches a row still holding the original default text, so a
-- template Admin already edited is left alone. Data-only; nothing is deleted.

UPDATE "NotificationTemplate"
SET "body" = 'Hi {{customerName}}, {{requestMessage}} {{tripSummary}}. Your reference: {{leadReference}}.', "updatedAt" = CURRENT_TIMESTAMP
WHERE "event" = 'LEAD_RECEIVED' AND "channel" = 'WHATSAPP'
  AND "body" = 'Hi {{customerName}}, {{requestMessage}} Your reference: {{leadReference}}.';

UPDATE "NotificationTemplate"
SET "body" = 'Hi {{customerName}}, your {{serviceType}} booking is created. Booking ID: {{bookingId}}. {{tripSummary}}. Amount: {{amount}}. Tap Pay Now below to complete your payment, then upload your documents on the same page. — Team TripNexio', "updatedAt" = CURRENT_TIMESTAMP
WHERE "event" = 'PAYMENT_LINK_READY' AND "channel" = 'WHATSAPP'
  AND "body" = 'Hi {{customerName}}, your {{serviceType}} booking is created. Booking ID: {{bookingId}}. Amount: {{amount}}. Complete your payment here: {{paymentLink}} (valid until {{linkExpiresAt}}). After payment you can upload your documents on the same page. — Team TripNexio';

UPDATE "NotificationTemplate"
SET "body" = E'Hi {{customerName}},\n\nThank you for choosing TripNexio. Your {{serviceType}} booking has been created.\n\nBooking ID: {{bookingId}}\nAmount: {{amount}} ({{paymentPurpose}})\n\nComplete your payment with the button below:\n{{paymentLink}}\n\nAfter payment you can upload the required documents from the same page.\n\nBest regards,\nTeam TripNexio', "updatedAt" = CURRENT_TIMESTAMP
WHERE "event" = 'PAYMENT_LINK_READY' AND "channel" = 'EMAIL'
  AND "body" = E'Hi {{customerName}},\n\nThank you for choosing TripNexio. Your {{serviceType}} booking has been created.\n\nBooking ID: {{bookingId}}\nAmount: {{amount}} ({{paymentPurpose}})\n\nComplete your payment here: {{paymentLink}}\nThis link is valid until {{linkExpiresAt}}.\n\nAfter payment you can upload the required documents from the same page.\n\nBest regards,\nTeam TripNexio';

UPDATE "NotificationTemplate"
SET "body" = 'Hi {{customerName}}, we''ve received your payment of {{amount}} for booking {{bookingId}} ({{tripSummary}}). Thank you for choosing TripNexio!', "updatedAt" = CURRENT_TIMESTAMP
WHERE "event" = 'PAYMENT_RECEIVED' AND "channel" = 'WHATSAPP'
  AND "body" = 'Hi {{customerName}}, we''ve received your payment of {{amount}} for booking {{bookingId}}. Thank you for choosing TripNexio!';

UPDATE "NotificationTemplate"
SET "body" = 'Hi {{customerName}}, your quote for {{leadReference}} is ready: {{sellingPrice}} (valid until {{quoteValidUntil}}). Tap View & Pay below to review and pay. — Team TripNexio', "updatedAt" = CURRENT_TIMESTAMP
WHERE "event" = 'QUOTE_READY' AND "channel" = 'WHATSAPP'
  AND "body" = 'Hi {{customerName}}, your quote for {{leadReference}} is ready: {{sellingPrice}} (valid until {{quoteValidUntil}}). Review and pay here: {{reviewLink}}';

-- The delivered visa / ticket / reservation reaches WhatsApp too, with a Download button.
INSERT INTO "NotificationTemplate" ("id", "event", "channel", "subject", "body", "active", "updatedAt")
VALUES (
  'notification-template-output-delivered-wa',
  'OUTPUT_DELIVERED',
  'WHATSAPP',
  NULL,
  'Hi {{customerName}}, your {{documentName}} for booking {{leadReference}} is ready. Tap Download below to get it. — Team TripNexio',
  true,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("event", "channel") DO NOTHING;
