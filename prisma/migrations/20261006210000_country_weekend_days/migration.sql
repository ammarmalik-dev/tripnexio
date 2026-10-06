-- Client corrections 2026-10-05: working days per country (Admin → Holidays).
-- Null = the System Configuration weekend, so nothing changes until Admin sets it.

-- AlterTable
ALTER TABLE "Country" ADD COLUMN     "weekendDays" TEXT;

