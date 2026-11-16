-- Client doc 16 Nov (I6) — the payment confirmation (email + WhatsApp) carries an "Upload Documents" button that opens
-- the booking's document upload. Only rows still on the catalog default button (Track Status / View Booking).
UPDATE "NotificationTemplate"
SET "ctaLabel" = 'Upload Documents', "ctaLink" = 'secure_upload_link', "updatedAt" = now()
WHERE "event" IN ('NV_PAYMENT_RECEIVED', 'VC_PAID', 'EXT_07', 'OTB_02_PAYMENT_SUCCESSFUL', 'RVT_PAID', 'SF_08')
  AND "ctaLink" = 'track_status_url';
