-- Client corrections 2026-10-05: Visa Change quotations list package inclusions / exclusions.

-- AlterTable
ALTER TABLE "Quotation" ADD COLUMN     "exclusions" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "inclusions" TEXT[] DEFAULT ARRAY[]::TEXT[];

