-- AlterTable
ALTER TABLE "Airline" ADD COLUMN     "standardProcessingDays" INTEGER,
ADD COLUMN     "urgentProcessingDays" INTEGER;

-- CreateTable
CREATE TABLE "OtbRuleConfig" (
    "id" TEXT NOT NULL,
    "standardProcessingDays" INTEGER NOT NULL,
    "urgentProcessingDays" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OtbRuleConfig_pkey" PRIMARY KEY ("id")
);

