-- Client 2026-10-23 audit — Return Ticket FAQ #2 read "a return or return ticket" (the usual phrase is "return or
-- onward"). Updated only while it still has the original seeded text, so an Admin edit is never overwritten.
UPDATE "Faq"
SET "question" = 'Why might I need a return or onward ticket?',
    "answer" = 'Some airlines, immigration authorities, visa processes or travel situations may require proof of return or onward travel.',
    "updatedAt" = now()
WHERE "id" = 'faq-return-ticket-2'
  AND "question" = 'Why might I need a return or return ticket?';
