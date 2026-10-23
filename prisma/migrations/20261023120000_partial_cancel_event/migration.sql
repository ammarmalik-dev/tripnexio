-- Client 2026-10-23 audit — a completed partial refund fires REFUND_PARTIALLY_COMPLETED, but no status carried it,
-- so the booking never showed "Partially Cancelled" and the customer got no message. Tag every service's
-- booking-level "Partially Cancelled" with the event (only where Admin hasn't set another one).
UPDATE "ServiceStatus"
SET "systemEvent" = 'REFUND_PARTIALLY_COMPLETED', "updatedAt" = now()
WHERE "scope" = 'BOOKING' AND "name" = 'Partially Cancelled' AND "systemEvent" IS NULL;
