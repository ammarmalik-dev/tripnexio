-- CreateEnum
CREATE TYPE "EnquiryCategory" AS ENUM ('GENERAL', 'BOOKING', 'PAYMENT', 'DOCUMENTS', 'FEEDBACK', 'COMPLAINT');

-- CreateEnum
CREATE TYPE "EnquiryStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'CONVERTED');

-- CreateTable
CREATE TABLE "Enquiry" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "category" "EnquiryCategory" NOT NULL DEFAULT 'GENERAL',
    "status" "EnquiryStatus" NOT NULL DEFAULT 'NEW',
    "fullName" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "bookingReference" TEXT,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "customerId" TEXT,
    "assignedStaffId" TEXT,
    "escalatedAt" TIMESTAMP(3),
    "resolutionNote" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "convertedLeadId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Enquiry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Enquiry_reference_key" ON "Enquiry"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "Enquiry_convertedLeadId_key" ON "Enquiry"("convertedLeadId");

-- CreateIndex
CREATE INDEX "Enquiry_category_idx" ON "Enquiry"("category");

-- CreateIndex
CREATE INDEX "Enquiry_status_idx" ON "Enquiry"("status");

-- CreateIndex
CREATE INDEX "Enquiry_createdAt_idx" ON "Enquiry"("createdAt");

-- CreateIndex
CREATE INDEX "Enquiry_assignedStaffId_idx" ON "Enquiry"("assignedStaffId");

-- CreateIndex
CREATE INDEX "Enquiry_customerId_idx" ON "Enquiry"("customerId");

-- AddForeignKey
ALTER TABLE "Enquiry" ADD CONSTRAINT "Enquiry_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enquiry" ADD CONSTRAINT "Enquiry_assignedStaffId_fkey" FOREIGN KEY ("assignedStaffId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enquiry" ADD CONSTRAINT "Enquiry_convertedLeadId_fkey" FOREIGN KEY ("convertedLeadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Customer acknowledgement for a Contact-form enquiry (ENQUIRY_RECEIVED), email only.
-- Neutral, factual copy; Admin-editable afterwards. Never overwrites an existing template.
INSERT INTO "NotificationTemplate" ("id", "event", "channel", "subject", "body", "active", "updatedAt")
VALUES
  ('notification-template-enquiry-received', 'ENQUIRY_RECEIVED', 'EMAIL',
   'We received your message ({{enquiryReference}})',
   E'Hi {{customerName}},\n\nThank you for contacting TripNexio. We have received your message "{{subject}}" and our team will get back to you shortly.\n\nYour reference is {{enquiryReference}}. Please keep it handy if you contact us again.\n\n— TripNexio',
   true, CURRENT_TIMESTAMP),
  ('notification-template-complaint-received', 'COMPLAINT_RECEIVED', 'EMAIL',
   'Your complaint has been registered ({{enquiryReference}})',
   E'Hi {{customerName}},\n\nWe are sorry for the trouble. Your complaint "{{subject}}" has been registered with reference {{enquiryReference}} and passed to our escalation team, who will contact you as soon as possible.\n\n— TripNexio',
   true, CURRENT_TIMESTAMP)
ON CONFLICT ("event", "channel") DO NOTHING;