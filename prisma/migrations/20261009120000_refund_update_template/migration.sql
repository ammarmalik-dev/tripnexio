-- Client testing 2026-10-09 — the customer's refund updates (raised / approved / completed / rejected).
INSERT INTO "NotificationTemplate" ("id", "event", "channel", "subject", "body", "active", "updatedAt")
VALUES
  (
    'notification-template-refund-update',
    'REFUND_UPDATE',
    'EMAIL',
    'Refund update — Booking ID {{bookingId}}',
    E'Hi {{customerName}},\n\nYour refund of {{refundAmount}} for your {{serviceType}} booking {{bookingId}} {{refundStatus}}.\n\nIf you have any questions, reply to our support team with your Booking ID.\n\nBest regards,\nTeam TripNexio',
    true,
    CURRENT_TIMESTAMP
  ),
  (
    'notification-template-refund-update-wa',
    'REFUND_UPDATE',
    'WHATSAPP',
    NULL,
    E'Hi {{customerName}}, your refund of {{refundAmount}} for {{serviceType}} booking {{bookingId}} {{refundStatus}}. — Team TripNexio',
    true,
    CURRENT_TIMESTAMP
  )
ON CONFLICT ("event", "channel") DO NOTHING;
