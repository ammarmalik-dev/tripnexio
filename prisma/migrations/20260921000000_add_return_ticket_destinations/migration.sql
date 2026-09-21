-- AlterTable
ALTER TABLE "ReturnTicketRuleConfig" ADD COLUMN     "ninetyDayOffsetDays" INTEGER NOT NULL DEFAULT 90;

-- CreateTable
CREATE TABLE "ReturnTicketDestination" (
    "id" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "ratePerApplicant" DECIMAL(10,2) NOT NULL,
    "validityOptions" TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReturnTicketDestination_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReturnTicketDestination_countryId_key" ON "ReturnTicketDestination"("countryId");

-- CreateIndex
CREATE INDEX "ReturnTicketDestination_active_idx" ON "ReturnTicketDestination"("active");

-- AddForeignKey
ALTER TABLE "ReturnTicketDestination" ADD CONSTRAINT "ReturnTicketDestination_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

