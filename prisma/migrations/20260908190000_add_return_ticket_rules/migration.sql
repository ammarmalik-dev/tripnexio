-- Step 10 (client-locked-spec DEVELOPMENT_ROADMAP.md): Return_Verified_Ticket.md
-- §5/§6/§7, locked. The customer selects only visa type (30/60 days) + travel
-- date; the return/onward date is server-computed, never customer-entered
-- (AUDIT_REPORT.md flagged the pre-Step-10 schema/route as not confirmed to
-- implement this). §6 also locks that the day-offset rule "must be
-- configurable rather than hard-coded" -> ReturnTicketRuleConfig singleton.
-- §7 locks the 24-hour issue-then-expire reservation window -> new
-- Booking columns.

-- CreateEnum
CREATE TYPE "ReturnTicketVisaType" AS ENUM ('THIRTY_DAYS', 'SIXTY_DAYS');

-- CreateTable
CREATE TABLE "ReturnTicketRuleConfig" (
    "id" TEXT NOT NULL,
    "thirtyDayOffsetDays" INTEGER NOT NULL,
    "sixtyDayOffsetDays" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReturnTicketRuleConfig_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Booking"
    ADD COLUMN "reservationIssuedAt" TIMESTAMP(3),
    ADD COLUMN "reservationExpiresAt" TIMESTAMP(3),
    ADD COLUMN "reservationExpired" BOOLEAN NOT NULL DEFAULT false;
