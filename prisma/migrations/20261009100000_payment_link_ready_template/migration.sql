-- Client testing 2026-10-09 — the customer's message when a payment link is
-- created (website checkout for New Visa / OTB / Return Ticket, CRM payment
-- link, extra payment). Admin can edit both rows in Notification Templates.
INSERT INTO "NotificationTemplate" ("id", "event", "channel", "subject", "body", "active", "updatedAt")
VALUES
  (
    'notification-template-payment-link-ready',
    'PAYMENT_LINK_READY',
    'EMAIL',
    'Complete your payment — Booking ID {{bookingId}}',
    E'Hi {{customerName}},\n\nThank you for choosing TripNexio. Your {{serviceType}} booking has been created.\n\nBooking ID: {{bookingId}}\nAmount: {{amount}} ({{paymentPurpose}})\n\nComplete your payment here: {{paymentLink}}\nThis link is valid until {{linkExpiresAt}}.\n\nAfter payment you can upload the required documents from the same page.\n\nBest regards,\nTeam TripNexio',
    true,
    CURRENT_TIMESTAMP
  ),
  (
    'notification-template-payment-link-ready-wa',
    'PAYMENT_LINK_READY',
    'WHATSAPP',
    NULL,
    E'Hi {{customerName}}, your {{serviceType}} booking is created. Booking ID: {{bookingId}}. Amount: {{amount}}. Complete your payment here: {{paymentLink}} (valid until {{linkExpiresAt}}). After payment you can upload your documents on the same page. — Team TripNexio',
    true,
    CURRENT_TIMESTAMP
  )
ON CONFLICT ("event", "channel") DO NOTHING;
