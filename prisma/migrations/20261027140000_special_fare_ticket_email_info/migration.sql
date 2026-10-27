-- Client doc 2026-10-27 (A8), data only: the Special Fare "ticket issued" email (SF_15, Domestic and
-- International) ends with the client's "Important Information" block word for word (it was a numbered list
-- without its heading). Rows Admin already rewrote (no "1. Travel Documents:" line) are left alone.

UPDATE "NotificationTemplate"
SET "body" = left("body", position('Check all details immediately and report errors within 12 hours of ticket issuance.' in "body") - 1) || 'Important Information
Airport Reporting: Arrive at least 2 hours before domestic flights and 4 hours before international flights.
Travel Documents: Carry a valid government-issued photo ID for domestic travel. International travellers must carry a valid passport, applicable visas and transit documents.
Terminal & Timings: Confirm the departure terminal and latest flight status with the airline. All timings are local to the respective airports.
Web Check-in: Complete airline web check-in and obtain your boarding pass where required.
Baggage: Check the baggage allowance mentioned on your ticket.
Changes & Refunds: Cancellations, refunds and rescheduling are subject to airline fare rules and applicable charges.
Travel Requirements: Passengers are responsible for meeting visa, transit, immigration and OTB requirements, where applicable.
Ticket Verification Disclaimer: Please check all ticket details, including passenger names, travel dates, flight timings and routes, immediately upon receipt. Report any errors to TripNexio within 12 hours of ticket issuance. Later corrections will be subject to airline rules, availability and applicable charges.

Have a safe and pleasant journey with TripNexio!',
    "updatedAt" = now()
WHERE "event" = 'SF_15' AND "channel" = 'EMAIL'
  AND "body" LIKE '%1. Travel Documents:%'
  AND position('Check all details immediately and report errors within 12 hours of ticket issuance.' in "body") > 0;
