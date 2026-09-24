-- Step 51 (Internal Dashboard Merged §8) — bank-transfer payment collection.
-- A brand-new enum type + new nullable/defaulted columns on an existing
-- table is safe in one transaction (unlike ALTER TYPE ADD VALUE above,
-- this isn't modifying a type any existing row already uses).
CREATE TYPE "PaymentMethod" AS ENUM ('GATEWAY', 'BANK_TRANSFER');

ALTER TABLE "Payment" ADD COLUMN "method" "PaymentMethod" NOT NULL DEFAULT 'GATEWAY';
ALTER TABLE "Payment" ADD COLUMN "bankSlipUrl" TEXT;
