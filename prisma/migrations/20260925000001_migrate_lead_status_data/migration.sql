-- Step 49 (Internal Dashboard Merged §6) — part 2 of 2. Data migration,
-- then retires QUOTED/ON_HOLD from the enum (Postgres has no
-- "ALTER TYPE ... DROP VALUE", so this uses the standard
-- create-new-type/swap-column/drop-old-type pattern, only safe now that no
-- row references either retired value).
--
-- QUOTED splits by whether its Quotation was actually accepted (client
-- confirmed this exact ambiguity via the roadmap prompt itself) --
-- QUOTATION_ACCEPTED if the lead has a selected quotation, QUOTATION_CREATED
-- otherwise. ON_HOLD -> FOLLOW_UP_REQUIRED (client confirmed: closest
-- semantic match -- "paused, needs revisiting"). These UPDATEs are
-- idempotent (WHERE status = 'QUOTED'/'ON_HOLD' simply matches 0 rows on a
-- second run) -- this migration was hand-fixed once already after its
-- first attempt failed on a dependent column (ServiceStatus.mapsToLeadStatus,
-- also LeadStatus-typed) that hadn't been accounted for; the UPDATEs below
-- had already committed successfully before that failure.

UPDATE "Lead" SET "status" = 'QUOTATION_ACCEPTED'
WHERE "status" = 'QUOTED'
  AND EXISTS (SELECT 1 FROM "Quotation" WHERE "Quotation"."leadId" = "Lead"."id" AND "Quotation"."isSelected" = true);

UPDATE "Lead" SET "status" = 'QUOTATION_CREATED'
WHERE "status" = 'QUOTED';

UPDATE "Lead" SET "status" = 'FOLLOW_UP_REQUIRED'
WHERE "status" = 'ON_HOLD';

-- ServiceStatus.mapsToLeadStatus is the same enum type but had zero rows
-- referencing QUOTED/ON_HOLD at migration time (verified) -- still cast
-- below since it's the same Postgres type and must move to the new type
-- together with Lead.status.
UPDATE "ServiceStatus" SET "mapsToLeadStatus" = 'QUOTATION_ACCEPTED' WHERE "mapsToLeadStatus" = 'QUOTED';
UPDATE "ServiceStatus" SET "mapsToLeadStatus" = 'FOLLOW_UP_REQUIRED' WHERE "mapsToLeadStatus" = 'ON_HOLD';

-- No row references QUOTED or ON_HOLD anymore -- safe to retire both.
CREATE TYPE "LeadStatus_new" AS ENUM (
  'NEW', 'CONTACTED', 'FOLLOW_UP_REQUIRED', 'CUSTOMER_RESPONDED', 'QUALIFIED',
  'QUOTATION_CREATED', 'QUOTATION_ACCEPTED', 'PAYMENT_PENDING', 'CONVERTED', 'LOST', 'CLOSED'
);

ALTER TABLE "Lead" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Lead" ALTER COLUMN "status" TYPE "LeadStatus_new" USING ("status"::text::"LeadStatus_new");
ALTER TABLE "Lead" ALTER COLUMN "status" SET DEFAULT 'NEW';

ALTER TABLE "ServiceStatus" ALTER COLUMN "mapsToLeadStatus" TYPE "LeadStatus_new" USING ("mapsToLeadStatus"::text::"LeadStatus_new");

DROP TYPE "LeadStatus";
ALTER TYPE "LeadStatus_new" RENAME TO "LeadStatus";
