-- Client doc 16 Nov (H12 / A13) — a Special Fare booking sent to the airline or ticketed is not refunded directly:
-- staff follow the airline ticket-cancellation steps (an Admin override can still refund). Same flag the other
-- services set on their hand-over step (catalog.ts).
UPDATE "ServiceStatus" SET "blocksRefund" = true, "updatedAt" = now()
WHERE "serviceType" = 'FLIGHT_SPECIAL_FARE' AND "scope" = 'BOOKING' AND "name" IN ('Sent to Airlines', 'Ticket Issued');
