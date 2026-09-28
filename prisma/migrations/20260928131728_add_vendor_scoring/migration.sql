-- AlterTable
ALTER TABLE "Vendor" ADD COLUMN     "performanceScore" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "processingTimeScore" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "reliabilityScore" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "serviceSuitabilityScore" INTEGER NOT NULL DEFAULT 3;

-- CreateTable
CREATE TABLE "VendorScoringConfig" (
    "id" TEXT NOT NULL,
    "serviceSuitabilityWeight" INTEGER NOT NULL DEFAULT 25,
    "processingTimeWeight" INTEGER NOT NULL DEFAULT 25,
    "performanceWeight" INTEGER NOT NULL DEFAULT 25,
    "reliabilityWeight" INTEGER NOT NULL DEFAULT 25,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorScoringConfig_pkey" PRIMARY KEY ("id")
);
