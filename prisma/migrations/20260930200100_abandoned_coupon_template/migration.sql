-- P24: abandoned-quotation coupon notification (ABANDONED_QUOTE_COUPON), email + WhatsApp.
-- Neutral, factual copy; Admin-editable afterwards. Never overwrites an existing template.
-- The WhatsApp row has no metaTemplateName yet, so it is skipped (audited) until Meta approves it.
INSERT INTO "NotificationTemplate" ("id", "event", "channel", "subject", "body", "active", "updatedAt")
VALUES
  ('notification-template-abandoned-quote-coupon', 'ABANDONED_QUOTE_COUPON', 'EMAIL',
   'A single-use coupon for your request {{leadReference}}',
   E'Hi {{customerName}},\n\nYour request {{leadReference}} hasn''t been completed yet. If you''d still like to go ahead, you can use this single-use coupon on it:\n\nCoupon code: {{couponCode}}\nDiscount: {{couponValue}}\nValid until: {{validUntil}}\n\nThe coupon applies only to this request. Contact us if you''d like an updated quote.\n\n— TripNexio',
   true, CURRENT_TIMESTAMP),
  ('notification-template-abandoned-quote-coupon-wa', 'ABANDONED_QUOTE_COUPON', 'WHATSAPP', NULL,
   'Hi {{customerName}}, your request {{leadReference}} isn''t completed yet. If you''d still like to go ahead, coupon {{couponCode}} gives {{couponValue}} off this request, valid until {{validUntil}}. Single use, for this request only.',
   true, CURRENT_TIMESTAMP)
ON CONFLICT ("event", "channel") DO NOTHING;
