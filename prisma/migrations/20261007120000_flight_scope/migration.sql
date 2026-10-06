
-- CreateEnum
CREATE TYPE "FlightScope" AS ENUM ('DOMESTIC', 'INTERNATIONAL');

-- AlterTable
ALTER TABLE "Quotation" ADD COLUMN     "flightScope" "FlightScope",
ADD COLUMN     "fromAirportCode" TEXT,
ADD COLUMN     "toAirportCode" TEXT;

-- AlterTable
ALTER TABLE "ServiceTerms" ADD COLUMN     "flightScope" "FlightScope";

