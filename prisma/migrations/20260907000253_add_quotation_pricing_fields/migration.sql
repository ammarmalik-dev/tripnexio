-- AlterTable
ALTER TABLE "Quotation" ADD COLUMN     "adultFare" DECIMAL(10,2),
ADD COLUMN     "arrivalDateTime" TIMESTAMP(3),
ADD COLUMN     "baggageAllowance" TEXT,
ADD COLUMN     "childFare" DECIMAL(10,2),
ADD COLUMN     "fareType" TEXT,
ADD COLUMN     "feeAmount" DECIMAL(10,2),
ADD COLUMN     "fineOrCharges" DECIMAL(10,2),
ADD COLUMN     "infantFare" DECIMAL(10,2);

