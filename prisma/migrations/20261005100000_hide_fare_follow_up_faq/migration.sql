-- Client correction 2026-10-05: the Special Fare 7-day follow-up is an internal
-- CRM workflow and must not appear on the website. Unpublish (not delete) the
-- FAQ that described it; Admin -> FAQs can still see and edit it.
UPDATE "Faq" SET "published" = false, "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'faq-flight-special-fare-25';
