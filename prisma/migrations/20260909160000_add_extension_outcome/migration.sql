-- Step 15 (client-locked-spec DEVELOPMENT_ROADMAP.md, audit §7.4):
-- Visa_Extension.md §17/§18, locked: "Not Accepted" and "Rejected" are
-- separate CRM statuses with different refund treatment, which the generic
-- BookingStatus/RefundStatus enums can't represent.

-- CreateEnum
CREATE TYPE "ExtensionOutcome" AS ENUM ('NOT_ACCEPTED', 'REJECTED');

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN "extensionOutcome" "ExtensionOutcome";
