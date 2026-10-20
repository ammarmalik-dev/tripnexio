-- Client doc 2026-10-20 (I2) — the customer is told when their Contact-form enquiry is resolved / closed, with the remark.
INSERT INTO "NotificationTemplate" ("id", "event", "channel", "subject", "body", "active", "ctaLabel", "ctaLink", "createdAt", "updatedAt")
VALUES
  ('nt_' || md5('ENQUIRY_RESOLVED/EMAIL'), 'ENQUIRY_RESOLVED', 'EMAIL', 'Your enquiry {{enquiryReference}} has been {{statusWord}}',
   E'Hi {{customerName}},\n\nYour enquiry {{enquiryReference}} ({{subject}}) has been {{statusWord}}.\n\nRemark: {{resolutionNote}}\n\nIf you need anything else, reach us on WhatsApp or reply through the Contact page.', true, NULL, NULL, now(), now()),
  ('nt_' || md5('ENQUIRY_RESOLVED/WHATSAPP'), 'ENQUIRY_RESOLVED', 'WHATSAPP', NULL,
   E'Hi {{customerName}}, your enquiry {{enquiryReference}} ({{subject}}) has been {{statusWord}}.\nRemark: {{resolutionNote}}', true, NULL, NULL, now(), now())
ON CONFLICT ("event", "channel") DO NOTHING;
