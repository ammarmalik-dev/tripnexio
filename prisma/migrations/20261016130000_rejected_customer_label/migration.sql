-- Client doc 2026-10-15 (I3) — a rejection shows "Rejected" to the customer (CRM, portal, Track Status,
-- notifications), never the coarse "Cancelled". Only fills statuses that have no customer label yet.
UPDATE "ServiceStatus"
SET "customerLabel" = 'Rejected'
WHERE "customerLabel" IS NULL AND "name" ILIKE '%reject%';
