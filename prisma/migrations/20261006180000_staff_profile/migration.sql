-- Client corrections 2026-10-05: staff profile fields from the Create Staff form.

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "mobile" TEXT,
ADD COLUMN     "officialId" TEXT,
ADD COLUMN     "personalDetails" TEXT;

