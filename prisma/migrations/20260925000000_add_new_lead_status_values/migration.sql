-- Step 49 (Internal Dashboard Merged §6) — part 1 of 2. Postgres requires a
-- new enum value to be committed before it can be used in an UPDATE, so
-- this migration ONLY adds the 6 genuinely new values; the data migration
-- that uses them, and the retirement of QUOTED/ON_HOLD, is the next
-- migration (20260925000001). Purely additive, zero data touched here.

ALTER TYPE "LeadStatus" ADD VALUE 'FOLLOW_UP_REQUIRED';
ALTER TYPE "LeadStatus" ADD VALUE 'CUSTOMER_RESPONDED';
ALTER TYPE "LeadStatus" ADD VALUE 'QUOTATION_CREATED';
ALTER TYPE "LeadStatus" ADD VALUE 'QUOTATION_ACCEPTED';
ALTER TYPE "LeadStatus" ADD VALUE 'PAYMENT_PENDING';
ALTER TYPE "LeadStatus" ADD VALUE 'CLOSED';
