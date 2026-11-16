-- Client doc 16 Nov 2026 (M3 / H10): every notification button opens its own page instead of the pay page.
-- Only rows still on the catalog default (ctaLink = 'secure_link') with one of these labels move, so a
-- template Admin has pointed elsewhere is left alone. Data only; no schema change.

-- Track Status / View Booking / … -> the Track page, looked up with the booking's page key.
UPDATE "NotificationTemplate"
SET "ctaLink" = 'track_status_url'
WHERE "ctaLink" = 'secure_link'
  AND "ctaLabel" IN ('Track Status', 'View Status', 'Track Application', 'View Booking', 'View Request', 'View Details');

-- Track Refund / Track Cancellation / … -> the refund section of the customer's booking page.
UPDATE "NotificationTemplate"
SET "ctaLink" = 'secure_refund_link'
WHERE "ctaLink" = 'secure_link'
  AND "ctaLabel" IN ('Track Refund', 'View Refund Details', 'Track Cancellation', 'View Cancellation Request');
