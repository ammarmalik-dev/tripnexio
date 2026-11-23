-- Client doc 16 Nov (N1 / N2 / N4) - automation on / off, SLA repeat + further escalation, a separate Document Reminder template.
CREATE TABLE "AutomationSetting" (
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AutomationSetting_pkey" PRIMARY KEY ("key")
);

ALTER TABLE "EscalationRule" ADD COLUMN "repeatEveryHours" INTEGER;
ALTER TABLE "EscalationRule" ADD COLUMN "furtherEscalateAfterHours" INTEGER;

-- Neutral copy, Admin-editable afterwards; never overwrites an existing template.
INSERT INTO "NotificationTemplate" ("id", "event", "channel", "subject", "heading", "body", "ctaLabel", "active", "updatedAt")
VALUES
  ('notification-template-document-reminder', 'DOCUMENT_REMINDER', 'EMAIL',
   'Reminder: documents pending for {{bookingId}}', 'Documents Pending',
   E'Hi {{customerName}},

We are still waiting for the following documents for your {{serviceName}} booking {{bookingId}}:
{{documentName}}

Please upload clear, valid copies so we can continue processing.',
   'Upload Documents', true, CURRENT_TIMESTAMP),
  ('notification-template-document-reminder-wa', 'DOCUMENT_REMINDER', 'WHATSAPP', NULL, NULL,
   E'Hi {{customerName}}, a reminder: we are still waiting for these documents for your {{serviceName}} booking {{bookingId}}:
{{documentName}}
Please upload them here: {{uploadLink}}',
   NULL, true, CURRENT_TIMESTAMP)
ON CONFLICT ("event", "channel") DO NOTHING;
