-- Client corrections 2026-10-05: expenses record the GST amount and a bill reference;
-- Total Amount = amount + gstAmount. Existing rows get GST 0 (unchanged totals).

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "gstAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "reference" TEXT;

