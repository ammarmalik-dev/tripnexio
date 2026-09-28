-- CreateEnum
CREATE TYPE "HolidayCountry" AS ENUM ('INDIA', 'UAE');

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "termsAcceptedAt" TIMESTAMP(3),
ADD COLUMN     "termsAcceptedIp" TEXT,
ADD COLUMN     "termsId" TEXT,
ADD COLUMN     "termsVersion" INTEGER;

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "deliveredAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "SystemConfig" ADD COLUMN     "weekendDaysIndia" TEXT NOT NULL DEFAULT '0,6',
ADD COLUMN     "weekendDaysUae" TEXT NOT NULL DEFAULT '0,6',
ADD COLUMN     "workdayEndHour" INTEGER NOT NULL DEFAULT 18,
ADD COLUMN     "workdayStartHour" INTEGER NOT NULL DEFAULT 9;

-- CreateTable
CREATE TABLE "CustomerPasswordResetToken" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerPasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceTerms" (
    "id" TEXT NOT NULL,
    "serviceType" "ServiceType" NOT NULL,
    "countryId" TEXT,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceTerms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Holiday" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "country" "HolidayCountry" NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Holiday_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomerPasswordResetToken_tokenHash_key" ON "CustomerPasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "CustomerPasswordResetToken_customerId_idx" ON "CustomerPasswordResetToken"("customerId");

-- CreateIndex
CREATE INDEX "ServiceTerms_serviceType_countryId_idx" ON "ServiceTerms"("serviceType", "countryId");

-- CreateIndex
CREATE INDEX "Holiday_country_active_idx" ON "Holiday"("country", "active");

-- CreateIndex
CREATE UNIQUE INDEX "Holiday_date_country_key" ON "Holiday"("date", "country");

-- AddForeignKey
ALTER TABLE "CustomerPasswordResetToken" ADD CONSTRAINT "CustomerPasswordResetToken_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceTerms" ADD CONSTRAINT "ServiceTerms_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- P09: delivering an output document moves the booking to the matching
-- per-service status (only fills an empty systemEvent — never overrides
-- an Admin choice).
UPDATE "ServiceStatus" SET "systemEvent" = v.event
FROM (VALUES
  ('NEW_VISA', 'Visa PDF Delivered', 'DELIVERED_VISA_PDF'),
  ('VISA_EXTENSION', 'Visa Delivered', 'DELIVERED_EXTENDED_VISA_PDF'),
  ('VISA_CHANGE', 'Package Generated', 'DELIVERED_PACKAGE_PDF'),
  ('VISA_CHANGE', 'Visa Delivered', 'DELIVERED_VISA_PDF'),
  ('RETURN_TICKET', 'Ticket Issued', 'DELIVERED_TICKET_PDF'),
  ('RETURN_TICKET', 'Delivered', 'DELIVERED_RESERVATION_PDF'),
  ('FLIGHT_SPECIAL_FARE', 'Ticket Issued', 'DELIVERED_TICKET_PDF'),
  ('OTB', 'OTB Approved', 'DELIVERED_OTB_CONFIRMATION')
) AS v(service, name, event)
WHERE "ServiceStatus"."serviceType" = v.service::"ServiceType"
  AND "ServiceStatus"."scope" = 'BOOKING'
  AND "ServiceStatus"."name" = v.name
  AND "ServiceStatus"."systemEvent" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "ServiceStatus" other
    WHERE other."serviceType" = v.service::"ServiceType" AND other."scope" = 'BOOKING' AND other."systemEvent" = v.event
  );
