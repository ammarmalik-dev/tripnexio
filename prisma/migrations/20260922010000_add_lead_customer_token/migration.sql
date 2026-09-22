-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "customerToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Lead_customerToken_key" ON "Lead"("customerToken");

