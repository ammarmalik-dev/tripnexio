-- Step 38 (Tier 2 §2, Admin FINAL handover): approval workflow for
-- StaffLeave. Existing rows are backfilled to APPROVED (not the new
-- PENDING default) specifically to preserve their already-true
-- auto-assignment exclusion behavior -- see eligible-for-assignment.ts,
-- which now gates on status=APPROVED instead of any row's mere existence.
-- No approvedByUserId/approvedAt is backfilled for these -- we have no real
-- record of who approved them or when, and fabricating one would violate
-- CLAUDE.md hard rule #1; both stay NULL for grandfathered rows.

-- CreateEnum
CREATE TYPE "LeaveStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "LeaveType" AS ENUM ('SICK', 'CASUAL', 'OTHER');

-- AlterTable
ALTER TABLE "StaffLeave"
  ADD COLUMN "status" "LeaveStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "type" "LeaveType" NOT NULL DEFAULT 'OTHER',
  ADD COLUMN "approvedByUserId" TEXT,
  ADD COLUMN "approvedAt" TIMESTAMP(3);

-- Backfill: every pre-existing row was already being treated as an
-- authoritative, exclusion-worthy leave record (only staff.manage/Admin
-- could create one) -- preserve that behavior exactly.
UPDATE "StaffLeave" SET "status" = 'APPROVED';

-- CreateIndex
CREATE INDEX "StaffLeave_status_idx" ON "StaffLeave"("status");

-- AddForeignKey
ALTER TABLE "StaffLeave" ADD CONSTRAINT "StaffLeave_approvedByUserId_fkey"
  FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
