-- Step 52 (Internal Dashboard Merged §9) — Extra Payment Collection.
-- A brand-new enum type + new nullable/defaulted columns on an existing
-- table is safe in one transaction, same as Step 51's PaymentMethod add.
CREATE TYPE "PaymentPurpose" AS ENUM ('PRIMARY', 'EXTRA');

ALTER TABLE "Payment" ADD COLUMN "purpose" "PaymentPurpose" NOT NULL DEFAULT 'PRIMARY';
ALTER TABLE "Payment" ADD COLUMN "description" TEXT;
